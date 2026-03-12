import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Send, Utensils, Coffee, Pizza, ChevronRight, X } from 'lucide-react';
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

export default function App() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tableCarts, setTableCarts] = useState<Record<number, CartItem[]>>({});
  const [orderedTables, setOrderedTables] = useState<Set<number>>(new Set());
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Món ăn');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Get current table's cart
  const cart = selectedTable ? (tableCarts[selectedTable] || []) : [];

  // Helper to update table carts
  const updateTableCart = (tableId: number, newCart: CartItem[]) => {
    setTableCarts(prev => ({ ...prev, [tableId]: newCart }));
  };

  // Selection states for "Món ăn"
  const [selectionStep, setSelectionStep] = useState<'base' | 'style' | 'size' | 'topping' | 'preference'>('base');
  const [tempBaseItem, setTempBaseItem] = useState<MenuItem | null>(null);
  const [tempStyle, setTempStyle] = useState<string | null>(null);
  const [tempSize, setTempSize] = useState<string | null>(null);
  const [tempTopping, setTempTopping] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => setMenu(data))
      .catch(err => console.error("Error loading menu:", err));
  }, []);

  const categories = ['Món ăn', 'Nước', 'Chén', 'Phụ lục'];

  const sizes = [
    { name: 'Tô Thường', priceAdj: 0 },
    { name: 'Đặc Biệt', priceAdj: 35000 },
    { name: 'Nhỏ', priceAdj: -15000 },
    { name: 'Em Bé', priceAdj: -35000 }
  ];

  const styles = ['Nước', 'Khô'];
  const toppings = ['Thập Cẩm', 'Tôm Tim Trứng', 'Không Gan', 'Không Nạc', 'Không Lòng'];
  const preferences = ['Bình thường', 'Trụi', 'Không Hành Phi', 'Không Tỏi Phi', 'Không Hành Lá'];

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
        setOrderSuccess(data.orderId);
        updateTableCart(selectedTable, []);
        setOrderedTables(prev => new Set(prev).add(selectedTable));
        setIsCartOpen(false);
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi đặt món. Vui lòng thử lại!");
    } finally {
      setIsOrdering(false);
    }
  };

  const filteredMenu = menu.filter(item => item.category === selectedCategory);

  // Table Selection View
  if (selectedTable === null) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] p-6">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold text-emerald-900">Nhân Quán Sài Gòn</h1>
          <p className="text-emerald-600 font-medium mt-2">Vui lòng chọn bàn để bắt đầu</p>
        </header>
        
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {Array.from({ length: 30 }, (_, i) => i + 1).map(num => {
            const hasItems = tableCarts[num] && tableCarts[num].length > 0;
            const isOrdered = orderedTables.has(num);
            
            let statusClasses = 'bg-white border-emerald-100 hover:border-emerald-500';
            let labelClasses = 'text-emerald-600';
            let numberClasses = 'text-emerald-900';
            let statusText = null;

            if (hasItems) {
              statusClasses = 'bg-red-50 border-red-200 hover:border-red-500';
              labelClasses = 'text-red-600';
              numberClasses = 'text-red-900';
              statusText = <span className="text-[8px] font-bold text-red-500 mt-1 animate-pulse">ĐANG CHỌN</span>;
            } else if (isOrdered) {
              statusClasses = 'bg-blue-50 border-blue-200 hover:border-blue-500';
              labelClasses = 'text-blue-600';
              numberClasses = 'text-blue-900';
              statusText = <span className="text-[8px] font-bold text-blue-500 mt-1">ĐÃ BÁO BẾP</span>;
            }

            return (
              <motion.button
                key={num}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedTable(num)}
                className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center shadow-sm transition-all ${statusClasses}`}
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
            <h1 className="text-xl font-display font-bold text-emerald-900">Bàn số {selectedTable}</h1>
            <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Nhân Quán Sài Gòn</p>
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

            {/* Step 2: Style (Nước / Khô) */}
            {selectionStep === 'style' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setSelectionStep('base')}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronRight className="rotate-180" size={14} /> Quay Lại
                  </button>
                  <h2 className="text-lg font-bold text-emerald-900">Chọn kiểu cho {tempBaseItem?.name}:</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {styles.map(style => (
                    <motion.button
                      key={style}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setTempStyle(style);
                        setSelectionStep('size');
                      }}
                      className="bg-emerald-600 text-white p-8 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-emerald-100"
                    >
                      {style}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Size */}
            {selectionStep === 'size' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setSelectionStep('style')}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronRight className="rotate-180" size={14} /> Quay Lại
                  </button>
                  <h2 className="text-lg font-bold text-emerald-900">Chọn kích cỡ ({tempStyle}):</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {sizes.map(size => (
                    <motion.button
                      key={size.name}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setTempSize(size.name);
                        setSelectionStep('topping');
                      }}
                      className="bg-white p-6 rounded-2xl border-2 border-emerald-100 flex flex-col items-center justify-center gap-2"
                    >
                      <span className="font-bold text-emerald-900">{size.name}</span>
                      <span className="text-xs text-emerald-600">
                        {((tempBaseItem?.price || 0) + size.priceAdj).toLocaleString('vi-VN')}đ
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Topping */}
            {selectionStep === 'topping' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setSelectionStep('size')}
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

      {/* Success Modal */}
      <AnimatePresence>
        {orderSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-emerald-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[32px] text-center relative z-10 max-w-sm w-full"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Utensils size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Đặt món thành công!</h2>
              <p className="text-gray-500 mb-6">Mã đơn: <span className="font-mono font-bold text-emerald-600">{orderSuccess}</span>. Bếp đang chuẩn bị món cho bạn.</p>
              <button 
                onClick={() => setOrderSuccess(null)}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold"
              >
                Tiếp tục gọi món
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
