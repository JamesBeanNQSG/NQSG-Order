import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Google Sheets Auth Setup (Placeholder logic - User will provide real keys)
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

  // API: Get Menu
  app.get("/api/menu", async (req, res) => {
    try {
      // Mock data if no Google Sheets configured yet
      if (!SPREADSHEET_ID) {
        return res.json([
          { id: 1, name: "Hủ Tiếu", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/hutieu/400/300", description: "Hủ tiếu Nam Vang truyền thống." },
          { id: 2, name: "Hủ Tiếu Mì", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/hutieumi/400/300", description: "Sự kết hợp giữa hủ tiếu và mì trứng." },
          { id: 3, name: "Mì", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/mi/400/300", description: "Mì trứng tươi ngon." },
          { id: 4, name: "Sủi Cảo", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/suicao/400/300", description: "Sủi cảo nhân tôm thịt đậm đà." },
          { id: 10, name: "Coca Cola", price: 15000, category: "Nước", image: "https://picsum.photos/seed/coke/400/300", description: "Nước ngọt có gas." },
          { id: 11, name: "Nước Suối", price: 10000, category: "Nước", image: "https://picsum.photos/seed/water/400/300", description: "Nước khoáng tinh khiết." },
          { id: 20, name: "Chén thêm", price: 0, category: "Chén", image: "https://picsum.photos/seed/bowl/400/300", description: "Yêu cầu thêm chén sạch." },
          { id: 21, name: "Muỗng đũa thêm", price: 0, category: "Chén", image: "https://picsum.photos/seed/spoon/400/300", description: "Yêu cầu thêm muỗng đũa." },
          { id: 30, name: "Khăn lạnh", price: 3000, category: "Phụ lục", image: "https://picsum.photos/seed/towel/400/300", description: "Khăn lạnh cao cấp." },
          { id: 31, name: "Trứng chần", price: 5000, category: "Phụ lục", image: "https://picsum.photos/seed/egg/400/300", description: "Trứng gà chần nước sôi." },
        ]);
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Menu!A2:G',
      });
      
      const rows = response.data.values;
      if (!rows) return res.json([]);

      const menu = rows.map(row => ({
        id: row[0],
        name: row[1],
        price: parseInt(row[2]),
        category: row[3],
        image: row[4],
        description: row[5],
        available: row[6] === 'TRUE'
      }));

      res.json(menu);
    } catch (error) {
      console.error("Error fetching menu:", error);
      res.status(500).json({ error: "Failed to fetch menu" });
    }
  });

  // API: Place Order
  app.post("/api/order", async (req, res) => {
    const { tableId, items, totalPrice } = req.body;
    const orderId = `ORD-${Date.now()}`;
    const createdAt = new Date().toLocaleString("vi-VN");

    try {
      if (!SPREADSHEET_ID) {
        console.log("Mock Order Received:", { orderId, tableId, items, totalPrice });
        return res.json({ success: true, orderId });
      }

      // 1. Write to Orders sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Orders!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[orderId, tableId, totalPrice, 'Pending', createdAt]]
        }
      });

      // 2. Write to OrderDetails sheet
      const detailRows = items.map((item: any) => [
        `DET-${Math.random().toString(36).substr(2, 9)}`,
        orderId,
        item.name,
        item.quantity,
        item.price,
        item.notes || "",
        item.toppings || ""
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'OrderDetails!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: detailRows
        }
      });

      // 3. Logic for Printing (Optional: Call PrintNode API here)
      // if (process.env.PRINTNODE_API_KEY) { ... }

      res.json({ success: true, orderId });
    } catch (error) {
      console.error("Error placing order:", error);
      res.status(500).json({ error: "Failed to place order" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
