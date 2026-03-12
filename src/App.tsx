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

  // BIẾN TẠM ĐỂ GÕ CHỮ/SỐ TRONG ADMIN
  const [editingItem, setEditingItem] = useState<Partial<MenuItem>>({ 
    name: '', 
    price: 0, 
    category: 'Món ăn',
    description: '',
    image: 'https://picsum.photos/seed/mi/400/300' 
  });

  useEffect(() => {
    fetch('./metadata.json')
      .then(res => res.json())
      .then(data => {
        setMenu(data.menu || data);
      })
      .catch(err => console.error("Không tải được menu:", err));

    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.toppings) setToppings(data.toppings);
        if (data.preferences) setPreferences(data.preferences);
      })
      .catch(err => console.log("Chưa có server config, dùng mặc định"));
  }, []);

  const categories = ['Món ăn', 'Nước', 'Chén', 'Phụ lục'];
  const styles = ['Nước', 'Khô'];
  const sizes = [
    { name: 'Tô Thường', priceAdj: 0 },
    { name: 'Đặc Biệt', priceAdj: 35000 },
    { name: 'Nhỏ', priceAdj: -15000 },
    { name: 'Em Bé', priceAdj: -35000 }
  ];

  const [selectionStep, setSelectionStep] = useState<'base' | 'style' | 'topping' | 'preference'>('base');
  const [tempBaseItem, setTempBaseItem] = useState<MenuItem | null>(null);
  const [tempStyle, setTempStyle] = useState<string | null>(null);
  const [tempSize, setTempSize] = useState<string | null>(null);
  const [tempTopping, setTempTopping] = useState<string | null>(null);
  const [toppings, setToppings] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);

  const updateTableCart = (tableId: number, newCart: CartItem[]) => {
    setTableCarts(prev => ({ ...prev, [tableId]: newCart }));
  };

  const addToCart = (item: MenuItem, size?: string, style?: string, topping?: string, preference?: string, finalPrice?: number) => {
    if (!selectedTable) return;
    const itemName = size && style && topping && preference
      ? `${item.name} (${style} - ${size} - ${topping}${preference !== 'Bình thường' ? ` - ${preference}` : ''})` 
      : item.name;
    const itemPrice = finalPrice !== undefined ? finalPrice : item.price;
    const currentCart = tableCarts[selectedTable] || [];
    const existing = currentCart.find(i => i.name === itemName);
    let newCart = existing 
      ? currentCart.map(i => i.name === itemName ? { ...i, quantity: i.quantity + 1 } : i)
      : [...currentCart, { ...item, name: itemName, price: itemPrice, quantity: 1, notes: '' }];
    updateTableCart(selectedTable, newCart);
    setSelectionStep('base'); setTempBaseItem(null);
  };

  const updateCartItemQuantity = (name: string, delta: number) => {
    if (!selectedTable) return;
    const currentCart = tableCarts[selectedTable] || [];
    const newCart = currentCart.map(item => item.name === name ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0);
    updateTableCart(selectedTable, newCart);
  };

  const handleOrder = async () => {
    if (!selectedTable || (tableCarts[selectedTable] || []).length === 0) return;
    setIsOrdering(true);
    const cart = tableCarts[selectedTable];
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: selectedTable, items: cart, totalPrice })
      });
      const data = await response.json();
      if (data.success) {
        setOrders(prev => [...prev, { id: data.orderId, tableId: selectedTable, items: [...cart], totalPrice, status: 'pending', timestamp: new Date() }]);
        updateTableCart(selectedTable, []);
        setOrderedTables(prev => new Set(prev).add(selectedTable));
        setIsCartOpen(false); setSelectedTable(null);
      }
    } catch (error) { console.log("Lỗi gửi order, thử lại trên Vercel nhé!"); }
    finally { setIsOrdering(false); }
  };

  // --- PHẦN ADMIN: SỬA ĐỂ GÕ ĐƯỢC CHỮ VÀ SỐ ---
  const addMenuItem = async () => {
    const newItem = {
      ...editingItem,
      id: Date.now(),
      name: editingItem.name || "Món mới",
      price: editingItem.price || 0,
      category: editingItem.category || "Món ăn",
      image: editingItem.image || "https://picsum.photos/seed/mi/400/300",
      description: editingItem.description || ""
    } as MenuItem;

    setMenu(prev => [...prev, newItem]);
    setEditingItem({ name: '', price: 0, category: 'Món ăn', description: '', image: 'https://picsum.photos/seed/mi/400/300' });

    try {
      await fetch('/api/admin/menu/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
    } catch (err) { console.log("Đã thêm tạm thời vào màn hình."); }
  };

  const updateMenuItemInList = async (item: MenuItem) => {
    setMenu(prev => prev.map(i => i.id === item.id ? item : i));
    try {
      await fetch('/api/admin/menu/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    } catch (err) { console.log("Đã cập nhật tạm thời."); }
  };

  const deleteMenuItem = async (id: number) => {
    setMenu(prev => prev.filter(i => i.id !== id));
    try { await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' }); } catch (err) { }
  };

  const updateConfig = async (newToppings?: string[], newPreferences?: string[]) => {
    if (newToppings) setToppings(newToppings);
    if (newPreferences) setPreferences(newPreferences);
    try {
      await fetch('/api/admin/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toppings: newToppings, preferences: newPreferences })
      });
    } catch (err) { }
  };

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
        <header className="p-6 bg-emerald-900 text-white flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Quản trị Thực đơn</h1></div>
          <button onClick={() => setView('service')} className="px-4 py-2 bg-white/10 rounded-xl">Quay lại</button>
        </header>

        <main className="p-6 max-w-4xl mx-auto w-full space-y-8">
          {/* KHU VỰC NHẬP MÓN MỚI */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-800">
              <PlusCircle size={20} /> Thêm món ăn mới cho Nhân Quán
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input 
                type="text" placeholder="Tên món" 
                value={editingItem.name}
                onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                className="p-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-emerald-500 font-bold"
              />
              <input 
                type="number" placeholder="Giá tiền" 
                value={editingItem.price || ''}
                onChange={(e) => setEditingItem({...editingItem, price: parseInt(e.target.value) || 0})}
                className="p-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
              />
              <select 
                value={editingItem.category}
                onChange={(e) => setEditingItem({...editingItem, category: e.target.
