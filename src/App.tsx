import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Send, Utensils, Coffee, Pizza, ChevronRight, X, Settings, Save, Edit, PlusCircle, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes: string;
}

interface Order {
  id: string;
  tableId: number;
  items: CartItem[];
  totalPrice: number;
  status: 'pending' | 'cooking' | 'completed';
  timestamp: Date;
}

export default function App() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tableCarts, setTableCarts] = useState<Record<number, CartItem[]>>({});
  const [orderedTables, setOrderedTables] = useState<Set<number>>(new Set());
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'service' | 'kitchen' | 'admin'>('service');
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Món ăn');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isMovingTable, setIsMovingTable] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [printingBill, setPrintingBill] = useState<Order | null>(null);

  // Auto-close printing bill
  useEffect(() => {
    if (printingBill) {
      const timer = setTimeout(() => {
        setPrintingBill(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [printingBill]);

  // Get current table's cart
  const cart = selectedTable ? (tableCarts[selectedTable] || []) : [];

  // Helper to update table carts
  const updateTableCart = (tableId: number, newCart: CartItem[]) => {
    setTableCarts(prev => ({ ...prev, [tableId]: newCart }));
  };

  // Selection states for "Món ăn"
  const [selectionStep, setSelectionStep] = useState<'base' | 'style' | 'topping' | 'preference'>('base');
  const [tempBaseItem, setTempBaseItem] = useState<MenuItem | null>(null);
  const [tempStyle, setTempStyle] = useState<string | null>(null);
  const [tempSize, setTempSize] = useState<string | null>(null);
  const [tempTopping, setTempTopping] = useState<string | null>(null);

  const [toppings, setToppings] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(err => console.error("Error loading menu:", err));

    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setToppings(data.toppings);
        setPreferences(data.preferences);
      })
      .catch(err => console.error("Error loading config:", err));
  }, []);

  const categories = ['Món ăn', 'Nước', 'Chén', 'Phụ lục'];

  const sizes = [
    { name: 'Tô Thường', priceAdj: 0 },
    { name: 'Đặc Biệt', priceAdj: 35000 },
    { name: 'Nhỏ', priceAdj: -15000 },
    { name: 'Em Bé', priceAdj: -35000 }
  ];

  const styles = ['Nước', 'Khô'];

  const addToCart = (item: MenuItem, size?: string, style?: string, topping?: string, preference?: string, finalPrice?: number) => {
    if (!selectedTable) return;

    const itemName = size && style && topping && preference
      ? `${item.name} (${style} - ${size} - ${topping}${preference !== 'Bình thường' ? ` - ${preference}` : ''})` 
      : item.name;
    const itemPrice = finalPrice !== undefined ? finalPrice : item.price;

    const currentCart = tableCarts[selectedTable] || [];
    const existing = currentCart.find(i => i.name === itemName);
    
    let newCart;
    if (existing) {
      newCart = currentCart.map(i => i.name === itemName ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newCart = [...currentCart, { ...item, name: itemName, price: itemPrice, quantity: 1, notes: '' }];
    }
    
    updateTableCart(selectedTable, newCart);

    // Reset selection
    setSelectionStep('base');
    setTempBaseItem(null);
    setTempStyle(null);
    setTempSize(null);
    setTempTopping(null);
  };

  const removeItemFromCart = (name: string) => {
    if (!selectedTable) return;
    const currentCart = tableCarts[selectedTable] || [];
    updateTableCart(selectedTable, currentCart.filter(i => i.name !== name));
  };

  const editCartItem = (item: CartItem) => {
    if (!selectedTable) return;
    
    // Remove from cart first
    removeItemFromCart(item.name);
    
    // Try to parse configuration from name if it's a "Món ăn"
    // Format: "Name (Style - Size - Topping - Preference)" or "Name (Style - Size - Topping)"
    if (item.category === 'Món ăn') {
      const match = item.name.match(/(.+) \((.+) - (.+) - ([^)]+)\)/);
      if (match) {
        const [_, baseName, style, size, rest] = match;
        const toppingParts = rest.split(' - ');
        const topping = toppingParts[0];
        const preference = toppingParts[1] || 'Bình thường';
        
        const baseItem = menu.find(m => m.name === baseName);
        if (baseItem) {
          setTempBaseItem(baseItem);
          setTempStyle(style);
          setTempSize(size);
          setTempTopping(topping);
          setSelectionStep('preference'); // Start from the last step or appropriate one
          setIsCartOpen(false);
          return;
        }
      }
    }
    
    // Fallback if parsing fails or not a complex item
    setSelectedCategory(item.category);
    setSelectionStep('base');
    setIsCartOpen(false);
  };

  const updateCartItemQuantity = (name: string, delta: number) => {
    if (!selectedTable) return;
    const currentCart = tableCarts[selectedTable] || [];
    const newCart = currentCart.map(item => {
      if (item.name === name) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0);
    updateTableCart(selectedTable, newCart);
  };

  const cancelTable = (tableId: number) => {
    updateTableCart(tableId, []);
    setOrderedTables(prev => {
      const next = new Set(prev);
      next.delete(tableId);
      return next;
    });
    setShowCancelConfirm(false);
    setSelectedTable(null);
  };

  const moveTable = (fromId: number, toId: number) => {
    if (fromId === toId) return;
    
    // Move cart
    const cartToMove = tableCarts[fromId] || [];
    const targetCart = tableCarts[toId] || [];
    updateTableCart(toId, [...targetCart, ...cartToMove]);
    updateTableCart(fromId, []);

    // Move ordered status
    setOrderedTables(prev => {
      const next = new Set(prev);
      if (next.has(fromId)) {
        next.add(toId);
        next.delete(fromId);
      }
      return next;
    });

    // Move orders in kitchen/history
    setOrders(prev => prev.map(order => 
      order.tableId === fromId ? { ...order, tableId: toId } : order
    ));

    setIsMovingTable(false);
    setSelectedTable(null);
  };

  const handlePayment = (tableId: number) => {
    // Clear orders for this table
    setOrders(prev => prev.filter(order => order.tableId !== tableId));
    
    // Clear cart for this table
    updateTableCart(tableId, []);
    
    // Remove from ordered tables set
    setOrderedTables(prev => {
      const next = new Set(prev);
      next.delete(tableId);
      return next;
    });

    // Return to table selection
    setSelectedTable(null);
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleOrder = async () => {
    if (!selectedTable) {
      alert("Vui lòng chọn bàn!");
      return;
    }
    if (cart.length === 0) return;

    setIsOrdering(true);
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable,
          items: cart,
          totalPrice
        })
      });
      const data = await response.json();
      if (data.success) {
        const newOrder: Order = {
          id: data.orderId,
          tableId: selectedTable,
          items: [...cart],
          totalPrice,
          status: 'pending',
          timestamp: new Date()
        };
        setOrders(prev => [...prev, newOrder]);
        updateTableCart(selectedTable, []);
        setOrderedTables(prev => new Set(prev).add(selectedTable));
        setIsCartOpen(false);
        setSelectedTable(null);
        setSelectionStep('base');
        setTempBaseItem(null);
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi đặt món. Vui lòng thử lại!");
    } finally {
      setIsOrdering(false);
    }
  };

  const filteredMenu = menu.filter(item => item.category === selectedCategory);

  const updateOrderStatus = (orderId: string, status: 'cooking' | 'completed') => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status } : order
    ));
    
    if (status === 'cooking') {
      const order = orders.find(o => o.id === orderId);
      if (order) setPrintingBill(order);
    }
  };

  const updateMenuItem = async (item: MenuItem) => {
    const res = await fetch('/api/admin/menu/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      const updated = await res.json();
      setMenu(prev => prev.map(i => i.id === updated.item.id ? updated.item : i));
    }
  };

  const addMenuItem = async (item: Partial<MenuItem>) => {
    const res = await fetch('/api/admin/menu/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      const added = await res.json();
      setMenu(prev => [...prev, added.item]);
    }
  };

  const deleteMenuItem = async (id: number) => {
    const res = await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMenu(prev => prev.filter(i => i.id !== id));
    }
  };

  const updateConfig = async (newToppings?: string[], newPreferences?: string[]) => {
    const res = await fetch('/api/admin/config/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toppings: newToppings, preferences: newPreferences })
    });
    if (res.ok) {
      const data = await res.json();
      setToppings(data.config.toppings);
      setPreferences(data.config.preferences);
    }
  };

  // Admin View UI
  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="p-6 bg-emerald-900 text-white flex items-center justify-between shadow-lg">
          <div>
            <h1 className="text-3xl font-display font-bold">Quản trị Hệ thống</h1>
            <p className="text-emerald-300 font-medium">Điều chỉnh thực đơn và cấu hình</p>
          </div>
          <button 
            onClick={() => setView('service')}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-colors flex items-center gap-2"
          >
            <ChevronRight className="rotate-180" size={20} />
            Quay lại Phục vụ
          </button>
        </header>

        <main className="flex-grow overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-12 pb-24">
          {/* Menu Management */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Pizza size={28} className="text-emerald-600" />
                Quản lý Thực đơn
              </h3>
              <button 
                onClick={() => addMenuItem({ name: "Món mới", price: 0, category: "Nước", image: "https://picsum.photos/seed/new/400/300", description: "" })}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
              >
                <PlusCircle size={20} /> Thêm món mới
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {menu.map(item => (
                <motion.div 
                  layout
                  key={item.id} 
                  className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-start md:items-center"
                >
                  <div className="relative group shrink-0">
                    <img src={item.image} className="w-24 h-24 rounded-2xl object-cover shadow-md" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => {
                        const newUrl = prompt("Nhập URL hình ảnh mới:", item.image);
                        if (newUrl) updateMenuItem({ ...item, image: newUrl });
                      }}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white rounded-2xl transition-opacity"
                    >
                      <ImageIcon size={24} />
                    </button>
                  </div>
                  <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tên món ăn</label>
                      <input 
                        type="text" 
                        value={item.name}
                        onChange={(e) => updateMenuItem({ ...item, name: e.target.value })}
                        className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm font-bold text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Giá bán (VNĐ)</label>
                      <input 
                        type="number" 
                        value={item.price}
                        onChange={(e) => updateMenuItem({ ...item, price: parseInt(e.target.value) || 0 })}
                        className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm font-bold text-emerald-700"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Danh mục</label>
                      <select 
                        value={item.category}
                        onChange={(e) => updateMenuItem({ ...item, category: e.target.value })}
                        className="w-full bg-gray-50 border-0 focus:ring-2 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm font-medium text-gray-700"
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm(`Xóa món ${item.name}?`)) deleteMenuItem(item.id);
                    }}
                    className="p-4 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors shrink-0"
                  >
                    <Trash2 size={24} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Toppings Management */}
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <PlusCircle size={24} className="text-emerald-600" />
                Quản lý Toppings
              </h3>
              <div className="flex flex-wrap gap-3">
                {toppings.map((t, i) => (
                  <motion.div 
                    layout
                    key={i} 
                    className="bg-emerald-50 text-emerald-700 pl-4 pr-2 py-2.5 rounded-xl flex items-center gap-2 font-bold text-sm border border-emerald-100"
                  >
                    <span>{t}</span>
                    <button 
                      onClick={() => updateConfig(toppings.filter((_, idx) => idx !== i))}
                      className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                ))}
                <button 
                  onClick={() => {
                    const val = prompt("Nhập Topping mới:");
                    if (val) updateConfig([...toppings, val]);
                  }}
                  className="px-4 py-2.5 border-2 border-dashed border-emerald-200 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-colors"
                >
                  + Thêm Topping
                </button>
              </div>
            </section>

            {/* Preferences Management */}
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <Edit size={24} className="text-emerald-600" />
                Quản lý Yêu cầu thêm
              </h3>
              <div className="flex flex-wrap gap-3">
                {preferences.map((p, i) => (
                  <motion.div 
                    layout
                    key={i} 
                    className="bg-orange-50 text-orange-700 pl-4 pr-2 py-2.5 rounded-xl flex items-center gap-2 font-bold text-sm border border-orange-100"
                  >
                    <span>{p}</span>
                    <button 
                      onClick={() => updateConfig(undefined, preferences.filter((_, idx) => idx !== i))}
                      className="p-1 hover:bg-orange-100 rounded-lg text-orange-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                ))}
                <button 
                  onClick={() => {
                    const val = prompt("Nhập Yêu cầu mới:");
                    if (val) updateConfig(undefined, [...preferences, val]);
                  }}
                  className="px-4 py-2.5 border-2 border-dashed border-orange-200 text-orange-600 rounded-xl text-sm font-bold hover:bg-orange-50 transition-colors"
                >
                  + Thêm Yêu cầu
                </button>
              </div>
            </section>
          </div>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-lg border-t border-gray-100 flex justify-center">
          <button 
            onClick={() => setView('service')}
            className="w-full max-w-md bg-emerald-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-emerald-100 active:scale-95 transition-transform"
          >
            LƯU TẤT CẢ & QUAY LẠI
          </button>
        </footer>
      </div>
    );
  }

  // Kitchen View UI
  if (view === 'kitchen') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-emerald-900">Giao diện Bếp</h1>
            <p className="text-emerald-600 font-medium">Quản lý đơn hàng đang chờ</p>
          </div>
          <button 
            onClick={() => setView('service')}
            className="px-6 py-3 bg-white border-2 border-emerald-100 text-emerald-600 rounded-2xl font-bold shadow-sm"
          >
            Quay lại Phục vụ
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.filter(o => o.status !== 'completed').map(order => (
            <motion.div 
              layout
              key={order.id}
              className={`bg-white rounded-[32px] shadow-xl overflow-hidden border-2 ${
                order.status === 'cooking' ? 'border-orange-200' : 'border-emerald-100'
              }`}
            >
              <div className={`p-6 flex items-center justify-between ${
                order.status === 'cooking' ? 'bg-orange-50' : 'bg-emerald-50'
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60">Bàn</span>
                  <h3 className="text-3xl font-display font-bold text-gray-900">{order.tableId}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold block opacity-60">MÃ ĐƠN</span>
                  <span className="font-mono font-bold text-emerald-700">{order.id}</span>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-4">
                      <div className="flex-grow">
                        <p className="font-bold text-gray-900 leading-tight">
                          <span className="text-emerald-600 mr-2">{item.quantity}x</span>
                          {item.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3">
                  {order.status === 'pending' ? (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'cooking')}
                      className="flex-grow bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
                    >
                      BẮT ĐẦU LÀM
                    </button>
                  ) : (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      className="flex-grow bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 active:scale-95 transition-transform"
                    >
                      HOÀN THÀNH
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {orders.filter(o => o.status !== 'completed').length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400">
              <Utensils size={64} className="mx-auto mb-4 opacity-10" />
              <p className="text-xl font-medium">Chưa có đơn hàng mới nào</p>
            </div>
          )}
        </div>

        {/* Simulated Bill Modal */}
        <AnimatePresence>
          {printingBill && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setPrintingBill(null)}
              />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white p-6 rounded-lg shadow-2xl relative z-10 w-full max-w-[300px] font-mono text-sm border-t-[10px] border-emerald-600"
              >
                <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
                  <h2 className="font-bold text-lg">NHÂN QUÁN SÀI GÒN</h2>
                  <p className="text-[10px]">Đang chế biến...</p>
                </div>
                
                <div className="flex justify-between mb-4">
                  <span className="font-bold">BÀN: {printingBill.tableId}</span>
                  <span>{new Date().toLocaleTimeString('vi-VN')}</span>
                </div>

                <div className="space-y-2 mb-6">
                  {printingBill.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start">
                      <span className="flex-grow">{item.quantity}x {item.name}</span>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-4 border-t border-dashed border-gray-300">
                  <p className="text-[10px] opacity-60">Mã đơn: {printingBill.id}</p>
                  <button 
                    onClick={() => setPrintingBill(null)}
                    className="mt-6 w-full bg-gray-900 text-white py-3 rounded-lg font-bold text-xs"
                  >
                    ĐÃ IN BILL
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Table Selection View (Normal or Moving)
  if (selectedTable === null || isMovingTable) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] p-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="text-left">
            <h1 className="text-3xl font-display font-bold text-emerald-900">
              {isMovingTable ? 'Chọn bàn chuyển đến' : 'Nhân Quán Sài Gòn'}
            </h1>
            <p className="text-emerald-600 font-medium mt-1">
              {isMovingTable 
                ? `Đang dời từ Bàn ${selectedTable}...` 
                : 'Vui lòng chọn bàn để bắt đầu'}
            </p>
          </div>
          {!isMovingTable && (
            <div className="flex gap-2">
              <button 
                onClick={() => setView('admin')}
                className="p-4 bg-white border-2 border-emerald-100 text-emerald-600 rounded-2xl font-bold shadow-sm flex flex-col items-center gap-1"
              >
                <Settings size={20} />
                <span className="text-[10px] uppercase">Admin</span>
              </button>
              <button 
                onClick={() => setView('kitchen')}
                className="p-4 bg-white border-2 border-emerald-100 text-emerald-600 rounded-2xl font-bold shadow-sm flex flex-col items-center gap-1 relative"
              >
                <Utensils size={20} />
                <span className="text-[10px] uppercase">Bếp</span>
                {orders.filter(o => o.status !== 'completed').length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {orders.filter(o => o.status !== 'completed').length}
                  </span>
                )}
              </button>
            </div>
          )}
        </header>
        
        {isMovingTable && (
          <div className="mb-8 text-center">
            <button 
              onClick={() => setIsMovingTable(false)}
              className="px-6 py-2 bg-gray-100 text-gray-600 rounded-full font-bold text-sm"
            >
              Hủy dời bàn
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {Array.from({ length: 30 }, (_, i) => i + 1).map(num => {
            const hasItems = tableCarts[num] && tableCarts[num].length > 0;
            const tableOrders = orders.filter(o => o.tableId === num);
            const isPending = tableOrders.some(o => o.status === 'pending' || o.status === 'cooking');
            const isServed = tableOrders.some(o => o.status === 'completed') && !isPending;
            const isSource = isMovingTable && num === selectedTable;
            
            let statusClasses = 'bg-white border-emerald-100 hover:border-emerald-500';
            let labelClasses = 'text-emerald-600';
            let numberClasses = 'text-emerald-900';
            let statusText = null;

            if (isSource) {
              statusClasses = 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 ring-offset-2';
              statusText = <span className="text-[8px] font-bold text-emerald-500 mt-1">BÀN GỐC</span>;
            } else if (hasItems) {
              statusClasses = 'bg-red-50 border-red-200 hover:border-red-500';
              labelClasses = 'text-red-600';
              numberClasses = 'text-red-900';
              statusText = <span className="text-[8px] font-bold text-red-500 mt-1 animate-pulse">ĐANG CHỌN</span>;
            } else if (isPending) {
              statusClasses = 'bg-blue-50 border-blue-200 hover:border-blue-500';
              labelClasses = 'text-blue-600';
              numberClasses = 'text-blue-900';
              statusText = <span className="text-[8px] font-bold text-blue-500 mt-1">ĐÃ BÁO BẾP</span>;
            } else if (isServed) {
              statusClasses = 'bg-emerald-50 border-emerald-200 hover:border-emerald-500';
              labelClasses = 'text-emerald-600';
              numberClasses = 'text-emerald-900';
              statusText = <span className="text-[8px] font-bold text-emerald-600 mt-1">ĐÃ RA MÓN</span>;
            }

            return (
              <motion.button
                key={num}
                disabled={isSource}
                whileHover={!isSource ? { scale: 1.05 } : {}}
                whileTap={!isSource ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (isMovingTable) {
                    moveTable(selectedTable!, num);
                  } else {
                    setSelectedTable(num);
                  }
                }}
                className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center shadow-sm transition-all ${statusClasses} ${isSource ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`text-xs font-bold uppercase ${labelClasses}`}>Bàn</span>
                <span className={`text-2xl font-display font-bold ${numberClasses}`}>{num}</span>
                {statusText}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setSelectedTable(null);
              setSelectionStep('base');
              setTempBaseItem(null);
              setTempSize(null);
            }}
            className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"
          >
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <div>
            <h1 className="text-xl font-display font-bold text-emerald-900 leading-none">Bàn số {selectedTable}</h1>
            <div className="flex gap-3 mt-2">
              <button 
                onClick={() => setIsMovingTable(true)}
                className="text-[13px] font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl uppercase tracking-wider shadow-sm active:scale-95 transition-transform"
              >
                Dời bàn
              </button>
              <button 
                onClick={() => setShowCancelConfirm(true)}
                className="text-[13px] font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl uppercase tracking-wider shadow-sm active:scale-95 transition-transform"
              >
                Hủy bàn
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
            Đang chọn món
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto px-4 py-4 no-scrollbar sticky top-[73px] bg-white/80 backdrop-blur-md z-20 border-b border-gray-50">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat);
              setSelectionStep('base');
              setTempBaseItem(null);
              setTempSize(null);
            }}
            className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                : 'bg-white text-gray-600 border border-gray-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Order History for Waiter */}
      {selectedTable && orders.some(o => o.tableId === selectedTable) && (
        <div className="px-4 py-2 bg-emerald-50/50 border-b border-emerald-100">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-2">
              <div className="flex items-center gap-2">
                <Utensils size={16} className="text-emerald-600" />
                <span className="text-sm font-bold text-emerald-900">Lịch sử đã gọi</span>
                <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.tableId === selectedTable).reduce((acc, o) => acc + o.items.length, 0)} món
                </span>
              </div>
              <ChevronRight size={16} className="text-emerald-400 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="pt-2 pb-4 space-y-3">
              {orders.filter(o => o.tableId === selectedTable).map((order, idx) => (
                <div key={order.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-emerald-50">
                    <span className="text-[10px] font-mono font-bold text-emerald-600">#{order.id.slice(-4)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {order.status === 'completed' ? 'Đã ra món' : 'Đang làm'}
                    </span>
                  </div>
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs py-1">
                      <span className="text-gray-600">{item.quantity}x {item.name}</span>
                      <span className="font-bold text-gray-900">{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                <span className="text-sm font-bold text-emerald-900">Tổng cộng đã gọi:</span>
                <span className="text-lg font-display font-bold text-emerald-600">
                  {orders.filter(o => o.tableId === selectedTable).reduce((acc, o) => acc + o.totalPrice, 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <button 
                onClick={() => setShowPaymentConfirm(true)}
                className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
              >
                <Utensils size={18} />
                Thanh toán & Trả bàn
              </button>
            </div>
          </details>
        </div>
      )}

      {/* Menu Grid / Selection Steps */}
      <div className="px-4 py-4">
        {selectedCategory === 'Món ăn' ? (
          <div className="space-y-6">
            {/* Step 1: Base Item */}
            {selectionStep === 'base' && (
              <div className="grid grid-cols-1 gap-4">
                <h2 className="text-lg font-bold text-emerald-900 mb-2">Chọn món chính:</h2>
                {filteredMenu.map(item => (
                  <motion.div 
                    key={item.id}
                    onClick={() => {
                      setTempBaseItem(item);
                      setTempStyle(null);
                      setTempSize(null);
                      setSelectionStep('style');
                    }}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer active:bg-emerald-50"
                  >
                    <div className="flex items-center gap-4">
                      <img src={item.image} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      <span className="font-bold text-gray-900">{item.name}</span>
                    </div>
                    <ChevronRight className="text-emerald-600" />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Step 2: Style & Size Combined */}
            {selectionStep === 'style' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <button 
                    onClick={() => {
                      setTempStyle(null);
                      setTempSize(null);
                      setSelectionStep('base');
                    }}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronRight className="rotate-180" size={14} /> Quay Lại
                  </button>
                  <h2 className="text-lg font-bold text-emerald-900">Tùy chọn cho {tempBaseItem?.name}:</h2>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">1. Chọn kiểu:</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {styles.map(style => (
                      <motion.button
                        key={style}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setTempStyle(style)}
                        className={`p-4 rounded-2xl font-bold text-lg transition-all ${
                          tempStyle === style 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2' 
                            : 'bg-white text-emerald-600 border-2 border-emerald-100'
                        }`}
                      >
                        {style}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">2. Chọn kích cỡ:</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {sizes.map(size => (
                      <motion.button
                        key={size.name}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setTempSize(size.name);
                          if (tempStyle) {
                            setSelectionStep('topping');
                          }
                        }}
                        className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                          tempSize === size.name 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2' 
                            : 'bg-white text-emerald-900 border-2 border-emerald-100'
                        }`}
                      >
                        <span className="font-bold">{size.name}</span>
                        <span className={`text-[10px] ${tempSize === size.name ? 'text-emerald-100' : 'text-emerald-500'}`}>
                          {((tempBaseItem?.price || 0) + size.priceAdj).toLocaleString('vi-VN')}đ
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {tempStyle && tempSize && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectionStep('topping')}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 mt-4"
                  >
                    Tiếp tục chọn Topping
                  </motion.button>
                )}
              </div>
            )}

            {/* Step 4: Topping */}
            {selectionStep === 'topping' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setSelectionStep('style')}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronRight className="rotate-180" size={14} /> Quay Lại
                  </button>
                  <h2 className="text-lg font-bold text-emerald-900">Chọn Topping:</h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {toppings.map(topping => (
                    <motion.button
                      key={topping}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setTempTopping(topping);
                        setSelectionStep('preference');
                      }}
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between text-left"
                    >
                      <span className="font-bold text-gray-900">{topping}</span>
                      <ChevronRight size={20} className="text-emerald-600" />
                    </motion.button>
                  ))}
                </div>
                <div className="mt-8 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs text-emerald-600 uppercase font-bold mb-1">Đang chọn:</p>
                  <p className="font-bold text-emerald-900">{tempBaseItem?.name} - {tempStyle} - {tempSize}</p>
                </div>
              </div>
            )}

            {/* Step 5: Preference */}
            {selectionStep === 'preference' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setSelectionStep('topping')}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronRight className="rotate-180" size={14} /> Quay Lại
                  </button>
                  <h2 className="text-lg font-bold text-emerald-900">Yêu cầu thêm:</h2>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {preferences.map(pref => (
                    <motion.button
                      key={pref}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (tempBaseItem && tempSize && tempStyle && tempTopping) {
                          const sizeObj = sizes.find(s => s.name === tempSize);
                          const finalPrice = (tempBaseItem.price || 0) + (sizeObj?.priceAdj || 0);
                          addToCart(tempBaseItem, tempSize, tempStyle, tempTopping, pref, finalPrice);
                        }
                      }}
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between text-left"
                    >
                      <span className="font-bold text-gray-900">{pref}</span>
                      <Plus size={20} className="text-emerald-600" />
                    </motion.button>
                  ))}
                </div>
                <div className="mt-8 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs text-emerald-600 uppercase font-bold mb-1">Đang chọn:</p>
                  <p className="font-bold text-emerald-900">{tempBaseItem?.name} - {tempStyle} - {tempSize} - {tempTopping}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredMenu.length > 0 ? filteredMenu.map(item => (
              <motion.div 
                layout
                key={item.id}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex"
              >
                <div className="w-32 h-32 flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{item.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-emerald-700 font-bold">
                      {item.price > 0 ? `${item.price.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                    </span>
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-emerald-50 text-emerald-600 p-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-20 text-gray-400">
                <Utensils size={48} className="mx-auto mb-4 opacity-20" />
                <p>Chưa có món trong danh mục này</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-6 left-4 right-4 z-40"
        >
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl shadow-2xl shadow-emerald-200 flex items-center justify-between px-6 font-bold"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <ShoppingCart size={20} />
              </div>
              <span>{cart.reduce((a, b) => a + b.quantity, 0)} món</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{totalPrice.toLocaleString('vi-VN')}đ</span>
              <ChevronRight size={20} />
            </div>
          </button>
        </motion.div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-50 max-h-[85vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Giỏ hàng của bạn</h2>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 bg-gray-50 rounded-full">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6 mb-8">
                  {cart.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-2">
                      <div className="flex gap-4 flex-grow">
                        <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        <div className="flex-grow">
                          <h4 className="font-bold text-sm leading-tight">{item.name}</h4>
                          <p className="text-emerald-600 text-sm font-medium mt-1">{(item.price * item.quantity).toLocaleString('vi-VN')}đ</p>
                          <div className="flex gap-2 mt-2">
                            <button 
                              onClick={() => editCartItem(item)}
                              className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md"
                            >
                              Sửa
                            </button>
                            <button 
                              onClick={() => removeItemFromCart(item.name)}
                              className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-xl shrink-0">
                        <button onClick={() => updateCartItemQuantity(item.name, -1)} className="p-1 text-gray-400"><Minus size={16} /></button>
                        <span className="font-bold w-4 text-center text-sm">{item.quantity}</span>
                        <button onClick={() => updateCartItemQuantity(item.name, 1)} className="p-1 text-emerald-600"><Plus size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div className="flex justify-between text-gray-500">
                    <span>Tạm tính</span>
                    <span>{totalPrice.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Tổng cộng</span>
                    <span className="text-emerald-700">{totalPrice.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <button 
                    onClick={handleOrder}
                    disabled={isOrdering}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {isOrdering ? 'Đang gửi...' : (
                      <>
                        <Send size={20} />
                        Gửi yêu cầu chế biến
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Payment Confirmation Modal */}
      <AnimatePresence>
        {showPaymentConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowPaymentConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[32px] text-center relative z-[71] max-w-sm w-full shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Utensils size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Xác nhận thanh toán</h2>
              <p className="text-gray-500 mb-8">
                Bạn có chắc chắn muốn thanh toán và trả bàn <span className="font-bold text-emerald-600">{selectedTable}</span>? 
                Hành động này sẽ xóa toàn bộ lịch sử gọi món hiện tại của bàn.
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    handlePayment(selectedTable!);
                    setShowPaymentConfirm(false);
                  }}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100"
                >
                  Xác nhận thanh toán
                </button>
                <button 
                  onClick={() => setShowPaymentConfirm(false)}
                  className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold"
                >
                  Hủy
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Table Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCancelConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[32px] text-center relative z-10 max-w-sm w-full"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Hủy bàn {selectedTable}?</h2>
              <p className="text-gray-500 mb-8 text-sm">Hành động này sẽ xóa toàn bộ món ăn đang chọn và đã báo bếp của bàn này. Bạn có chắc chắn?</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowCancelConfirm(false)}
                  className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
                >
                  Không, giữ lại
                </button>
                <button 
                  onClick={() => cancelTable(selectedTable!)}
                  className="py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-100"
                >
                  Có, hủy ngay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
