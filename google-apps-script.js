/**
 * Google Apps Script (GAS) for Restaurant Printing
 * 
 * Hướng dẫn:
 * 1. Mở Google Sheet của bạn.
 * 2. Chọn Extensions > Apps Script.
 * 3. Copy đoạn code dưới đây vào.
 * 4. Nhấn Save và Deploy dưới dạng Web App (Anyone has access).
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Ghi vào Sheet Orders
    var orderSheet = ss.getSheetByName("Orders");
    var orderId = "ORD-" + new Date().getTime();
    orderSheet.appendRow([
      orderId, 
      data.tableId, 
      data.totalPrice, 
      "Pending", 
      new Date()
    ]);
    
    // 2. Ghi vào Sheet OrderDetails
    var detailSheet = ss.getSheetByName("OrderDetails");
    data.items.forEach(function(item) {
      detailSheet.appendRow([
        "DET-" + Math.random().toString(36).substr(2, 9),
        orderId,
        item.name,
        item.quantity,
        item.price,
        item.notes || "",
        item.toppings || ""
      ]);
    });

    // 3. TỰ ĐỘNG IN (Sử dụng PrintNode)
    // Bạn cần đăng ký tài khoản tại PrintNode.com để lấy API Key
    // sendToPrinter(data);

    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "orderId": orderId }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hàm gửi lệnh in tới PrintNode
 */
function sendToPrinter(orderData) {
  var apiKey = "YOUR_PRINTNODE_API_KEY"; // Thay bằng API Key của bạn
  var printerId = "YOUR_PRINTER_ID"; // ID máy in trong PrintNode
  
  var content = "PHIẾU BÁO CHẾ BIẾN\n";
  content += "--------------------------\n";
  content += "Bàn: " + orderData.tableId + "\n";
  content += "Giờ đặt: " + new Date().toLocaleTimeString() + "\n";
  content += "--------------------------\n";
  
  orderData.items.forEach(function(item) {
    content += item.quantity + " x " + item.name + "\n";
    if (item.notes) content += "   *Ghi chú: " + item.notes + "\n";
  });
  
  content += "--------------------------\n";
  content += "XIN CẢM ƠN!\n\n\n\n";

  var payload = {
    "printerId": printerId,
    "title": "Order " + orderData.tableId,
    "contentType": "raw_base64",
    "content": Utilities.base64Encode(content)
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Basic " + Utilities.base64Encode(apiKey + ":")
    },
    "payload": JSON.stringify(payload)
  };

  UrlFetchApp.fetch("https://api.printnode.com/printjobs", options);
}
