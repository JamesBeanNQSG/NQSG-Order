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

  // In-memory store for mock data
  let mockMenu = [
    { id: 1, name: "Hủ Tiếu", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/hutieu/400/300", description: "Hủ tiếu Nam Vang truyền thống." },
    { id: 2, name: "Hủ Tiếu Mì", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/hutieumi/400/300", description: "Sự kết hợp giữa hủ tiếu và mì trứng." },
    { id: 3, name: "Mì", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/mi/400/300", description: "Mì trứng tươi ngon." },
    { id: 4, name: "Sủi Cảo", price: 95000, category: "Món ăn", image: "https://picsum.photos/seed/suicao/400/300", description: "Sủi cảo nhân tôm thịt đậm đà." },
    { id: 10, name: "Coca Cola", price: 15000, category: "Nước", image: "https://picsum.photos/seed/coke/400/300", description: "Nước ngọt có gas." },
    { id: 20, name: "Chén thêm", price: 0, category: "Chén", image: "https://picsum.photos/seed/bowl/400/300", description: "Yêu cầu thêm chén sạch." },
    { id: 21, name: "Muỗng đũa thêm", price: 0, category: "Chén", image: "https://picsum.photos/seed/spoon/400/300", description: "Yêu cầu thêm muỗng đũa." },
    { id: 30, name: "Khăn Lạnh", price: 3000, category: "Phụ lục", image: "https://picsum.photos/seed/towel/400/300", description: "Khăn lạnh cao cấp." },
    { id: 31, name: "Trà Đá", price: 2000, category: "Phụ lục", image: "https://picsum.photos/seed/tea/400/300", description: "Trà đá mát lạnh." },
    { id: 32, name: "Nước Suối", price: 10000, category: "Phụ lục", image: "https://picsum.photos/seed/water/400/300", description: "Nước khoáng tinh khiết." },
    { id: 33, name: "Trứng chần", price: 5000, category: "Phụ lục", image: "https://picsum.photos/seed/egg/400/300", description: "Trứng gà chần nước sôi." },
  ];

  let mockConfig = {
    toppings: ['Thập Cẩm', 'Tôm Tim Trứng', 'Hải Sản', 'Không Gan', 'Không Nạc', 'Không Lòng'],
    preferences: ['Bình thường', 'Trụi', 'Không Hành Phi', 'Không Tỏi Phi', 'Không Hành Lá'],
    printers: [
      { id: 'p1', name: 'Máy in Bếp', ip: '192.168.1.100', port: 9100, type: 'thermal', location: 'kitchen' },
      { id: 'p2', name: 'Máy in Quầy', ip: '192.168.1.101', port: 9100, type: 'thermal', location: 'counter' }
    ]
  };

  // API: Get Menu
  app.get("/api/menu", async (req, res) => {
    try {
      if (!SPREADSHEET_ID) {
        return res.json(mockMenu);
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Menu!A2:G',
      });
      
      const rows = response.data.values;
      if (!rows) return res.json([]);

      const menu = rows
        .map(row => ({
          id: row[0],
          name: row[1],
          price: parseInt(row[2]),
          category: row[3],
          image: row[4],
          description: row[5],
          available: row[6] === 'TRUE'
        }))
        .filter(item => item.available !== false);

      res.json(menu);
    } catch (error: any) {
      if (error.message?.includes("Google Sheets API has not been used")) {
        console.error("CRITICAL: Google Sheets API is not enabled.");
        console.error("Please visit this link to enable it: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=539790544552");
      } else if (error.message?.includes("Unable to parse range")) {
        console.error("CRITICAL: Sheet 'Menu' not found in your Google Spreadsheet.");
        console.error("Please ensure your Google Sheet has a tab named 'Menu'.");
      } else {
        console.error("Error fetching menu from Sheets, falling back to mock data:", error);
      }
      // Fallback to mock data so the app doesn't crash
      res.json(mockMenu);
    }
  });

  // API: Get Config
  app.get("/api/config", (req, res) => {
    res.json(mockConfig);
  });

  // API: Update Menu Item
  app.post("/api/admin/menu/update", (req, res) => {
    const item = req.body;
    const index = mockMenu.findIndex(i => i.id === item.id);
    if (index !== -1) {
      mockMenu[index] = { ...mockMenu[index], ...item };
      res.json({ success: true, item: mockMenu[index] });
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  });

  // API: Add Menu Item
  app.post("/api/admin/menu/add", (req, res) => {
    const item = req.body;
    const newId = Math.max(...mockMenu.map(i => i.id as number), 0) + 1;
    const newItem = { ...item, id: newId };
    mockMenu.push(newItem);
    res.json({ success: true, item: newItem });
  });

  // API: Delete Menu Item
  app.delete("/api/admin/menu/:id", async (req, res) => {
    const id = req.params.id;
    
    // Always update local mock for consistency
    mockMenu = mockMenu.filter(i => i.id.toString() !== id);

    try {
      if (SPREADSHEET_ID) {
        // 1. Find the row index
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Menu!A:A',
        });
        
        const rows = response.data.values;
        if (rows) {
          const rowIndex = rows.findIndex(row => row[0] === id);
          if (rowIndex !== -1) {
            // 2. Update column G (Available) to FALSE for that row
            // Row index is 0-based, so row 1 is index 0. Sheet rows are 1-based.
            const sheetRow = rowIndex + 1;
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `Menu!G${sheetRow}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [['FALSE']]
              }
            });
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting from Sheets:", error);
      res.json({ success: true, warning: "Deleted locally but failed to update Sheets" });
    }
  });

  // API: Update Config
  app.post("/api/admin/config/update", (req, res) => {
    const { toppings, preferences, printers } = req.body;
    if (toppings) mockConfig.toppings = toppings;
    if (preferences) mockConfig.preferences = preferences;
    if (printers) mockConfig.printers = printers;
    res.json({ success: true, config: mockConfig });
  });

  // API: Place Order
  app.post("/api/order", async (req, res) => {
    const { tableId, items, totalPrice } = req.body;
    const orderId = `ORD-${Date.now()}`;
    const createdAt = new Date().toLocaleString("vi-VN");

    try {
      if (!SPREADSHEET_ID) {
        console.log("Mock Order Received (No Sheet ID):", { orderId, tableId, items, totalPrice });
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

      res.json({ success: true, orderId });
    } catch (error: any) {
      if (error.message?.includes("Google Sheets API has not been used")) {
        console.error("CRITICAL: Google Sheets API is not enabled for order placement.");
        console.error("Please visit this link to enable it: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=539790544552");
      } else if (error.message?.includes("Unable to parse range")) {
        console.error("CRITICAL: Sheet 'Orders' or 'OrderDetails' not found in your Google Spreadsheet.");
        console.error("Please ensure your Google Sheet has tabs named 'Orders' and 'OrderDetails'.");
      } else {
        console.error("Error placing order to Sheets, falling back to mock processing:", error);
      }
      // Fallback to mock order so the user can still test the app
      console.log("Mock Order Received (Sheets Error):", { orderId, tableId, items, totalPrice });
      res.json({ success: true, orderId, warning: "Order saved locally only (Sheets API error)" });
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
