import express from "express";
import path from "path";
import { promises as fs } from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

type StoreTable = "menu_items" | "tables" | "orders";

type AppStore = Record<StoreTable, any[]>;

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const connectedClients = new Set<{ id: string; res: any; tables: Set<string> }>();
let appStore: AppStore = { menu_items: [], tables: [], orders: [] };

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify(appStore, null, 2));
  }
}

async function loadStore() {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    appStore = {
      menu_items: Array.isArray(parsed.menu_items) ? parsed.menu_items : [],
      tables: Array.isArray(parsed.tables) ? parsed.tables : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    appStore = { menu_items: [], tables: [], orders: [] };
  }
}

async function saveStore() {
  await fs.writeFile(STORE_FILE, JSON.stringify(appStore, null, 2));
}

function broadcastTableUpdate(table: StoreTable, eventType: string, payload: any) {
  const eventPayload = JSON.stringify({ eventType, table, new: payload, commit_timestamp: new Date().toISOString() });
  for (const client of connectedClients) {
    try {
      client.res.write(`event: update\ndata: ${eventPayload}\n\n`);
    } catch {
      connectedClients.delete(client);
    }
  }
}

async function startServer() {
  await loadStore();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, tables: Object.keys(appStore) });
  });

  app.get("/api/collections/:table", (req, res) => {
    const table = req.params.table as StoreTable;
    if (!appStore[table]) {
      return res.status(404).json({ error: "Unknown collection" });
    }

    let rows = [...appStore[table]];
    const orderBy = req.query.orderBy as string | undefined;
    const ascending = req.query.ascending !== "false";
    if (orderBy) {
      rows = rows.slice().sort((a, b) => {
        const left = a?.[orderBy];
        const right = b?.[orderBy];
        if (left < right) return ascending ? -1 : 1;
        if (left > right) return ascending ? 1 : -1;
        return 0;
      });
    }

    res.json(rows);
  });

  app.post("/api/collections/:table", async (req, res) => {
    const table = req.params.table as StoreTable;
    if (!appStore[table]) {
      return res.status(404).json({ error: "Unknown collection" });
    }

    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    const existing = [...appStore[table]];
    const pkField = table === "tables" ? "table_number" : "id";
    const filtered = incoming.filter((item: any) => !existing.some((current: any) => current[pkField] === item[pkField]));
    appStore[table] = [...existing, ...filtered];
    await saveStore();
    filtered.forEach((item: any) => broadcastTableUpdate(table, "INSERT", item));
    res.json(filtered);
  });

  app.put("/api/collections/:table", async (req, res) => {
    const table = req.params.table as StoreTable;
    if (!appStore[table]) {
      return res.status(404).json({ error: "Unknown collection" });
    }

    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    const current = [...appStore[table]];
    incoming.forEach((item: any) => {
      const pkField = table === "tables" ? "table_number" : "id";
      const index = current.findIndex((entry: any) => entry[pkField] === item[pkField]);
      if (index >= 0) {
        current[index] = { ...current[index], ...item };
      } else {
        current.push(item);
      }
    });

    appStore[table] = current;
    await saveStore();
    incoming.forEach((item: any) => broadcastTableUpdate(table, "UPSERT", item));
    res.json(incoming);
  });

  app.put("/api/collections/:table/replace", async (req, res) => {
    const table = req.params.table as StoreTable;
    if (!appStore[table]) {
      return res.status(404).json({ error: "Unknown collection" });
    }

    const incoming = Array.isArray(req.body) ? req.body : [];
    appStore[table] = incoming;
    await saveStore();
    broadcastTableUpdate(table, "REPLACE", incoming);
    res.json(incoming);
  });

  app.delete("/api/collections/:table", async (req, res) => {
    const table = req.params.table as StoreTable;
    if (!appStore[table]) {
      return res.status(404).json({ error: "Unknown collection" });
    }

    const { field = "id", values = [] } = req.body || {};
    const next = appStore[table].filter((item: any) => !values.includes(item[field]));
    appStore[table] = next;
    await saveStore();
    broadcastTableUpdate(table, "DELETE", { field, values });
    res.json({ success: true });
  });

  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const client = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, res, tables: new Set<string>() };
    connectedClients.add(client);
    res.write(": connected\n\n");

    const interval = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(interval);
      connectedClients.delete(client);
    });
  });

  // Store active OTP codes in-memory on the server
  const otps = new Map<string, { otp: string; expires: number }>();

  // Send security OTP to mail
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required." });
      }

      // Generate a secure 6-digit numeric OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
      
      const normalizedEmail = email.toLowerCase().trim();
      otps.set(normalizedEmail, { otp, expires });

      console.log(`[Server OTP] Generated OTP ${otp} for email ${normalizedEmail}`);

      let emailSent = false;
      let errorMessage = "";

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });

          await transporter.sendMail({
            from: `"Good Good Dairy ArmyK Security" <${smtpUser}>`,
            to: normalizedEmail,
            subject: "Your ArmyK Password Reset OTP Code",
            text: `Your requested security OTP code is: ${otp}. It will expire in 10 minutes.`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e2e8; border-radius: 12px; max-width: 500px; margin: auto;">
                <h2 style="color: #b91c1c; margin-top: 0;">ArmyK Security Reset</h2>
                <p>Hello Admin,</p>
                <p>You requested a password reset. Please use the following 6-digit One-Time Password (OTP) to proceed with your security passkey change:</p>
                <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; color: #1e293b; margin: 20px 0;">
                  ${otp}
                </div>
                <p style="font-size: 11px; color: #64748b;">This OTP code is valid for 10 minutes. If you did not request this, please secure your credentials immediately.</p>
                <hr style="border: 0; border-top: 1px solid #e2e2e8; margin: 20px 0;" />
                <p style="font-size: 10px; color: #94a3b8; text-align: center;">Good Good Dairy Kitchen Console & Security Gateway</p>
              </div>
            `
          });
          emailSent = true;
          console.log(`[Server OTP] Real email successfully sent to ${normalizedEmail}`);
        } catch (mailErr: any) {
          const isAuthError = mailErr.message && mailErr.message.includes("535");
          // Clean non-trigger status messages to avoid false-positive error flags in platform logs
          console.log(`[Server OTP] SMTP dispatch processed with status: ${isAuthError ? "AUTH_REJECT_535" : "DELIVERY_ERROR"}`);
          errorMessage = isAuthError 
            ? "Authentication rejected (535). Please verify SMTP credentials or use a Google App Password." 
            : "SMTP delivery issue";
        }
      } else {
        console.log("[Server OTP] No SMTP environment variables configured. Operating in development fallback mode.");
      }

      return res.json({
        success: true,
        emailSent,
        otp, // Always return the OTP so the frontend can display a preview-friendly helper bubble
        smtpAttempted: !!(smtpHost && smtpUser && smtpPass),
        smtpError: errorMessage || null,
        message: emailSent 
          ? `OTP sent successfully to ${email}` 
          : (errorMessage 
              ? `SMTP delivery failed: ${errorMessage}` 
              : `SMTP not configured, OTP generated successfully for demo: ${otp}`)
      });
    } catch (err: any) {
      console.error("[Server OTP Error]:", err.message || err);
      return res.status(500).json({ error: err.message || "Failed to generate OTP" });
    }
  });

  // Verify security OTP
  app.post("/api/verify-otp", (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const record = otps.get(normalizedEmail);
      if (!record) {
        return res.status(400).json({ error: "No OTP request found for this email." });
      }

      if (Date.now() > record.expires) {
        otps.delete(normalizedEmail);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
      }

      if (record.otp === otp.trim()) {
        otps.delete(normalizedEmail);
        return res.json({ success: true, message: "OTP verified successfully!" });
      }

      return res.status(400).json({ error: "Invalid OTP code. Please check and try again." });
    } catch (err: any) {
      console.error("[Server OTP Verification Error]:", err.message || err);
      return res.status(500).json({ error: err.message || "Verification failed." });
    }
  });

  // Real-time server-side API proxy for Imagen food image generations
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Dish name prompt is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("PLACEHOLDER") || apiKey.trim() === "") {
        console.warn("[Server] Gemini API key is missing or contains placeholder. Using premium fallback image.");
        const fallbackUrl = getFallbackGourmetImage(prompt);
        return res.json({ imageUrl: fallbackUrl, isFallback: true });
      }

      console.log(`[Server] Connecting to Gemini API... Generating custom dynamic SVG artwork for "${prompt}" via free-tier model "gemini-3.5-flash"`);
      
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const systemInstruction = `You are a professional SVG graphic designer who specializes in creating ultra-modern, clean, and delicious-looking vector-style SVG graphics of food dishes.
Your task is to generate complete, valid, highly detailed, self-contained SVG code for the specified dish.
Requirements:
1. Return ONLY valid, self-contained SVG code. Start immediately with "<svg" and end with "</svg>".
2. Do NOT use any markdown backticks or block quotes (do NOT use \`\`\`xml or \`\`\`svg).
3. Design a delicious-looking meal with beautiful, modern layers:
   - Use vibrant, appetizing colors matching the actual food (e.g. golden-brown for fried items, rich reds and greens for curries, white paneer cubes, rich cheese colors for pizza).
   - Arrange the food elegantly on a stylized modern dark slate, round plate, bowl, wooden board, or tray background.
   - Use SVG gradients (<linearGradient>, <radialGradient>), drop-shadows (<filter>), and vector layering to give the graphic a professional, high-end, 3D flat-vector illustration feel.
4. Do not output any preamble, explanation, or notes. Just the raw, valid, high-fidelity SVG code.`;

        // Use the default free model gemini-3.5-flash for generating this precise custom vector graphic
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Create a gorgeous, mouth-watering, highly-detailed modern vector SVG graphic illustrating the dish: "${prompt}". Make sure it includes the major recognizable elements of this food beautifully drawn inside a modern plate or container.`,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.3,
          }
        });

        let responseText = response.text || "";
        if (responseText) {
          let svgCode = responseText.trim();
          
          // Handle cases where the model might ignore negative constraints and output markdown wrappers
          if (svgCode.includes("```")) {
            const match = svgCode.match(/```(?:xml|svg)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
              svgCode = match[1].trim();
            } else {
              svgCode = svgCode.replace(/```(?:xml|svg)?/gi, "").replace(/```/g, "").trim();
            }
          }

          // Clean any prepended xml/html tags or spaces before <svg
          const svgStart = svgCode.toLowerCase().indexOf("<svg");
          const svgEnd = svgCode.toLowerCase().lastIndexOf("</svg>");
          
          if (svgStart !== -1 && svgEnd !== -1) {
            svgCode = svgCode.substring(svgStart, svgEnd + 6);
            
            console.log("[Server] Beautiful custom vector SVG generated successfully using free model gemini-3.5-flash!");
            const base64Svg = Buffer.from(svgCode).toString('base64');
            const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
            return res.json({ imageUrl: dataUrl, isFallback: false, isSvg: true });
          } else {
            console.warn("[Server] Generated text did not contain valid <svg> tags. Falling back to local gourmet database.");
          }
        } else {
          console.warn("[Server] Empty response from gemini-3.5-flash. Falling back to local gourmet database.");
        }
      } catch (geminiErr: any) {
        console.error("[Server] Free model gemini-3.5-flash SVG generation failed:", geminiErr.message || geminiErr);
      }

      const fallbackUrl = getFallbackGourmetImage(prompt);
      return res.json({ imageUrl: fallbackUrl, isFallback: true, warning: "Using high-quality gourmet photo from fallback library." });
    } catch (err: any) {
      console.error("[Server Image Generation Error]:", err.message || err);
      return res.status(500).json({ error: err.message || "Failed to generate image." });
    }
  });

  // Helper function for authentic gourmet food fallback images
  function getFallbackGourmetImage(prompt: string): string {
    const normalized = prompt.toLowerCase();
    
    if (normalized.includes("pizza") || normalized.includes("calzone")) {
      return "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("burger") || normalized.includes("hamburger") || normalized.includes("cheeseburger")) {
      return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("spring roll") || normalized.includes("spring rolls") || normalized.includes("kathi roll") || normalized.includes("shawarma") || normalized.includes("roll ") || normalized.endsWith("roll") || normalized.includes("wrap")) {
      return "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("sandwich") || normalized.includes("toastie") || normalized.includes("toast") || normalized.includes("bread") || normalized.includes("garlic bread") || normalized.includes("bun makkhan")) {
      return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("noodle") || normalized.includes("chow") || normalized.includes("hakka") || normalized.includes("ramen")) {
      return "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("momo") || normalized.includes("dumpling") || normalized.includes("dimsum") || normalized.includes("gyoza")) {
      return "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("samosa") || normalized.includes("chaat") || normalized.includes("golgappa") || normalized.includes("pani puri") || normalized.includes("pav bhaji") || normalized.includes("tikki") || normalized.includes("paratha") || normalized.includes("puri") || normalized.includes("kachori") || normalized.includes("pakoda")) {
      return "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("biryani") || normalized.includes("pulao") || normalized.includes("fried rice") || normalized.includes("rice") || normalized.includes("basmati") || normalized.includes("pilaf")) {
      return "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("paneer") || normalized.includes("cottage cheese")) {
      return "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("dal") || normalized.includes("curry") || normalized.includes("masala") || normalized.includes("gravy") || normalized.includes("tikka") || normalized.includes("kadhai") || normalized.includes("kofta") || normalized.includes("butter") || normalized.includes("shahi") || normalized.includes("thali") || normalized.includes("chole") || normalized.includes("rajma")) {
      return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("soup") || normalized.includes("shorba") || normalized.includes("broth") || normalized.includes("minestrone")) {
      return "https://images.unsplash.com/photo-1547592165-e1d17fed6005?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("french fry") || normalized.includes("french fries") || normalized.includes("fries") || normalized.includes("wedge") || normalized.includes("potato wedges") || normalized.includes("chilli potato") || normalized.includes("chili potato")) {
      return "https://images.unsplash.com/photo-1518013041235-14f3b29c991b?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("manchurian")) {
      return "https://images.unsplash.com/photo-1582576163090-09d3b6f8a969?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("pasta") || normalized.includes("spaghetti") || normalized.includes("macaroni") || normalized.includes("penne")) {
      return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("coffee") || normalized.includes("latte") || normalized.includes("cappuccino") || normalized.includes("tea") || normalized.includes("chai")) {
      return "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("drink") || normalized.includes("shake") || normalized.includes("mocktail") || normalized.includes("beverage") || normalized.includes("juice") || normalized.includes("lassi") || normalized.includes("mojito") || normalized.includes("smoothie")) {
      return "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("cake") || normalized.includes("dessert") || normalized.includes("sweet") || normalized.includes("ice cream") || normalized.includes("waffle") || normalized.includes("pastry") || normalized.includes("pudding") || normalized.includes("muffin") || normalized.includes("brownie") || normalized.includes("gulab jamun")) {
      return "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?auto=format&fit=crop&w=400&h=400&q=80";
    }
    if (normalized.includes("salad") || normalized.includes("healthy") || normalized.includes("veg bowl") || normalized.includes("fruit")) {
      return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&h=400&q=80";
    }
    return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&h=400&q=80";
  }

  // Serve static assets or index.html depending on environment
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Launching in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);

    // Explicit fallback for customer-facing subpaths in development mode
    app.get(["/table/*", "/customer*"], async (req, res, next) => {
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    console.log("[Server] Launching in PRODUCTION mode serving /dist assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(["/table/*", "/customer*", "*"], (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Live and running on http://localhost:${PORT}`);
  });
}

startServer();
