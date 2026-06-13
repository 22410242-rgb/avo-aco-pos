import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, Package, 
  CreditCard, X, Save, History, Ban, FileText, 
  User, Tag, MessageSquare, Printer, CheckCircle2,
  DollarSign, CreditCard as CardIcon, Layers, Settings,
  LayoutDashboard, List, BarChart3, Image as ImageIcon,
  AlertTriangle, ChevronRight, Edit3, Check, Upload,
  RotateCcw, Calculator, Download, RefreshCw, Eye,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDoc,
  getDocs,
  where,
  getDocFromServer,
  limit
} from 'firebase/firestore';
import { auth, db, googleProvider, secondaryAuth } from './firebase';
import { Product, OrderItem, Invoice, HeldOrder, PaymentMethod, Category, InvoiceStatus, RefundItem, User as UserType, UserRole, SystemSettings, AuditLog, RegisterSession, InventoryMovement } from './types';
import { initialCategories, initialProducts } from './data/initialData';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from './data';
import Reports from './components/Reports';

const ProductGrid = React.memo(({ products, onProductClick, settings }: {
  products: Product[],
  onProductClick: (product: Product) => void,
  settings: SystemSettings
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4">
      {products.map((product) => (
        <motion.button
          key={product.id}
          whileTap={{ scale: 0.95 }}
          onClick={() => onProductClick(product)}
          className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg hover:border-avocado-primary/20 transition-all group flex flex-col text-right"
        >
          <div className="aspect-square overflow-hidden relative">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
            {!product.hasSizes && (
              <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-avocado-primary border border-avocado-light">
                {(product.price || 0).toFixed(2)} {settings.currencySymbol}
              </div>
            )}
          </div>
          <div className="p-3 flex-1">
            <h3 className="font-semibold text-stone-800 line-clamp-2 leading-tight">{product.name}</h3>
            <p className="text-[10px] text-stone-400 mt-1 font-mono">{product.barcode}</p>
          </div>
        </motion.button>
      ))}
    </div>
  );
});
ProductGrid.displayName = 'ProductGrid';

import { Suppliers } from './components/Suppliers';
import { Expenses } from './components/Expenses';
import { Purchases } from './components/Purchases';
import { InventoryLog } from './components/InventoryLog';
import SettingsComponent from './components/Settings';
import { OpenRegisterModal, CloseRegisterModal } from './components/RegisterModals';
import { usePrint } from './hooks/usePrint';
import { PrintStudio } from './components/PrintStudio';
import { qzService } from './services/qzService';
import { ErrorBoundary } from './components/ErrorBoundary';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<'pos' | 'admin' | 'login' | 'my-sales' | 'expenses'>('login');
  const [adminSubView, setAdminSubView] = useState<'products' | 'categories' | 'dashboard' | 'invoices' | 'sales' | 'returns' | 'users' | 'suppliers' | 'purchases' | 'inventory-log' | 'expenses' | 'settings' | 'register-sessions'>('dashboard');
  const [users, setUsers] = useState<UserType[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    storeName: 'Avocados POS',
    storeLogo: 'https://res.cloudinary.com/dxziybs9n/image/upload/v1772234203/logo_avocados_2_c1mbav.png',
    storePhone: '0599000000',
    storeEmail: 'hello@avocados.cafe',
    storeAddress: 'Avocados Street, Cafe District',
    invoiceFooter: 'Thank you for visiting Avocados! Have a fresh day.',
    currency: 'ILS',
    currencySymbol: '₪',
    autoPrintAfterPayment: false,
    showOrderNumber: true,
    showCashierName: true,
    invoiceLayout: 'standard',
    kitchenPrinterName: 'Kitchen Printer',
    receiptPrinterName: 'Receipt Printer',
    isThermalPrinter: true,
    autoKitchenPrint: false,
    invoicePaperSize: 'Thermal',
    kitchenPaperSize: 'Thermal',
    useQZTray: false
  });
  const [isKitchenPrint, setIsKitchenPrint] = useState(false);
  const mySalesRef = useRef<HTMLDivElement>(null);
  const adminInvoicesRef = useRef<HTMLDivElement>(null);
  const invoiceDetailsRef = useRef<HTMLDivElement>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [selectedLoginUser, setSelectedLoginUser] = useState<UserType | null>(null);
  const [loginEmail, setLoginEmail] = useState('admin@pos.com');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<RegisterSession | null>(null);
  const [isOpenRegisterOpen, setIsOpenRegisterOpen] = useState(false);
  const [isCloseRegisterOpen, setIsCloseRegisterOpen] = useState(false);
  const [registerHistory, setRegisterHistory] = useState<RegisterSession[]>([]);
  const [viewingSession, setViewingSession] = useState<RegisterSession | null>(null);
  const [viewingSessionSummary, setViewingSessionSummary] = useState<any>(null);
  const [sessionViewMode, setSessionViewMode] = useState<'detailed' | 'simple'>('detailed');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [isReturnMode, setIsReturnMode] = useState(false);

  // Local persistence keys
  const STORAGE_KEYS = {
    USER: 'pos_user',
    USERS: 'pos_users',
    PRODUCTS: 'pos_products',
    CATEGORIES: 'pos_categories',
    INVOICES: 'pos_invoices',
    SETTINGS: 'pos_settings',
    SESSIONS: 'pos_sessions',
    ACTIVE_SESSION: 'pos_active_session',
    PURCHASES: 'pos_purchases',
    EXPENSES: 'pos_expenses',
    MOVEMENTS: 'pos_movements'
  };

  // Default admin user
  const DEFAULT_ADMIN: UserType = {
    id: 'admin-1',
    name: 'مدير النظام',
    email: 'admin@pos.com',
    password: 'admin123',
    role: 'Admin',
    createdAt: new Date().toISOString()
  };

  // Hardcoded credentials
  const HARDCODED_CREDENTIALS = {
    email: 'admin@pos.com',
    password: 'admin123'
  };

  // QZ Tray Auto-connect
  useEffect(() => {
    if (settings.useQZTray) {
      qzService.connect().catch(err => {
        console.warn('Failed to auto-connect to QZ Tray:', err);
      });
    }
    
    return () => {
      if (qzService.isConnected()) {
        qzService.disconnect();
      }
    };
  }, [settings.useQZTray]);

  useEffect(() => {
    document.title = settings.storeName;
  }, [settings.storeName]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            let userData = userDoc.data() as UserType;
            if (userData.email === 'mohammadalmasri950@gmail.com') {
              userData = { ...userData, name: 'مدير النظام' };
            }
            setCurrentUser(userData);
            setCurrentView('pos');
          } else {
            // Try to find user by email (in case their Auth UID doesn't match their Firestore ID)
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', firebaseUser.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              const oldDoc = querySnapshot.docs[0];
              const oldUserData = oldDoc.data() as UserType;
              
              // Migrate to new UID
              const newUserData = { 
                ...oldUserData, 
                id: firebaseUser.uid,
                name: oldUserData.email === 'mohammadalmasri950@gmail.com' ? 'مدير النظام' : oldUserData.name
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
              try {
                await deleteDoc(doc(db, 'users', oldDoc.id));
              } catch (e) {
                console.warn("Could not delete old user document during migration", e);
              }
              
              setCurrentUser(newUserData);
              setCurrentView('pos');
            } else if (firebaseUser.email === "mohammadalmasri950@gmail.com") {
              const newUser: UserType = {
                id: firebaseUser.uid,
                name: 'مدير النظام',
                email: firebaseUser.email || '',
                role: 'Admin',
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              setCurrentUser(newUser);
              setCurrentView('pos');
            } else {
              await signOut(auth);
              setShowToast('عذراً، غير مصرح لك بتسجيل الدخول. يرجى مراجعة الإدارة.');
              setTimeout(() => setShowToast(null), 5000);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setCurrentUser(null);
        setCurrentView('login');
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!isAuthReady) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), 
      (snapshot) => {
        const usersList = snapshot.docs.map(doc => {
          const data = doc.data() as UserType;
          if (data.email === 'mohammadalmasri950@gmail.com') {
            return { ...data, name: 'مدير النظام' };
          }
          return data;
        });
        setUsers(usersList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    if (!currentUser) {
      return () => unsubUsers();
    }

    const unsubProducts = onSnapshot(collection(db, 'products'), 
      (snapshot) => {
        const productsList = snapshot.docs.map(doc => doc.data() as Product);
        setProducts(productsList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    const unsubCategories = onSnapshot(collection(db, 'categories'), 
      (snapshot) => {
        const categoriesList = snapshot.docs.map(doc => doc.data() as Category);
        setCategories(categoriesList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'categories')
    );

    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc'), limit(500)), 
      (snapshot) => {
        const invoicesList = snapshot.docs.map(doc => doc.data() as Invoice);
        setInvoices(invoicesList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), 
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings(prev => ({ ...prev, ...snapshot.data() as SystemSettings }));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/config')
    );

    const unsubSessions = onSnapshot(query(collection(db, 'sessions'), orderBy('openingTime', 'desc'), limit(100)), 
      (snapshot) => {
        const sessionsList = snapshot.docs.map(doc => doc.data() as RegisterSession);
        setRegisterHistory(sessionsList);
        const active = sessionsList.find(s => s.status === 'Open');
        setActiveSession(active || null);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'sessions')
    );

    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(200)), 
      (snapshot) => {
        const expensesList = snapshot.docs.map(doc => doc.data() as any);
        setExpenses(expensesList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'expenses')
    );

    const unsubHeldOrders = onSnapshot(collection(db, 'heldOrders'), 
      (snapshot) => {
        const heldList = snapshot.docs.map(doc => doc.data() as HeldOrder);
        setHeldOrders(heldList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'heldOrders')
    );

    const unsubSuppliers = onSnapshot(query(collection(db, 'suppliers'), limit(200)), 
      (snapshot) => {
        const suppliersList = snapshot.docs.map(doc => doc.data() as any);
        setSuppliers(suppliersList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'suppliers')
    );

    const unsubSupplierTransactions = onSnapshot(query(collection(db, 'supplierTransactions'), limit(500)), 
      (snapshot) => {
        const transactionsList = snapshot.docs.map(doc => doc.data() as any);
        setSupplierTransactions(transactionsList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'supplierTransactions')
    );

    const unsubInventoryMovements = onSnapshot(query(collection(db, 'inventoryMovements'), orderBy('date', 'desc'), limit(200)), 
      (snapshot) => {
        const movementsList = snapshot.docs.map(doc => doc.data() as InventoryMovement);
        setInventoryMovements(movementsList);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventoryMovements')
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubInvoices();
      unsubSettings();
      unsubSessions();
      unsubExpenses();
      unsubHeldOrders();
      unsubUsers();
      unsubSuppliers();
      unsubSupplierTransactions();
      unsubInventoryMovements();
    };
  }, [currentUser, isAuthReady]);

  const handleResetFinancial = async () => {
    try {
      // 1. Reset invoice number in settings
      await updateSettings({ lastOrderNumber: 0 });

      // 2. Clear LocalStorage for financial data
      localStorage.removeItem(STORAGE_KEYS.INVOICES);
      localStorage.removeItem(STORAGE_KEYS.PURCHASES);
      localStorage.removeItem(STORAGE_KEYS.EXPENSES);
      localStorage.removeItem(STORAGE_KEYS.MOVEMENTS);
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      localStorage.removeItem('last_global_invoice_number');

      // 3. Delete from Firestore (if applicable)
      const collectionsToDelete = ['invoices', 'purchases', 'expenses', 'inventoryMovements', 'sessions', 'heldOrders'];
      for (const colName of collectionsToDelete) {
        try {
          const q = query(collection(db, colName));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
        } catch (e) {
          console.warn(`Could not delete collection ${colName}:`, e);
        }
      }

      // 4. Clear local state
      setInvoices([]);
      setPurchases([]);
      setExpenses([]);
      setInventoryMovements([]);
      setRegisterHistory([]);
      setActiveSession(null);
      setHeldOrders([]);
      
      setShowToast('تم تصفير البيانات المالية بنجاح ورجع رقم الفواتير للرقم 1');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      console.error('Error resetting financial data:', error);
      setShowToast('حدث خطأ أثناء تصفير البيانات', 'error');
    }
  };

  const updateSettings = async (updates: Partial<SystemSettings>) => {
    try {
      await setDoc(doc(db, 'settings', 'config'), updates, { merge: true });
      setShowToast('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/config');
    }
  };

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHeldOrdersOpen, setIsHeldOrdersOpen] = useState(false);
  const [isItemEditOpen, setIsItemEditOpen] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<Record<string, string>>({ Cash: '', Card: '', Wallet: '' });
  const [customerName, setCustomerName] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [isPrintingRefund, setIsPrintingRefund] = useState(false);
  const [showToast, _setShowToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const { 
    receiptRequest, 
    kitchenRequest, 
    triggerReceiptPrint, 
    triggerKitchenPrint, 
    clearReceiptPrint, 
    clearKitchenPrint 
  } = usePrint();

  const setShowToast = (message: string | null, type: 'success' | 'error' = 'success') => {
    if (message === null) {
      _setShowToast(null);
    } else {
      _setShowToast({ message, type });
    }
  };

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setShowToast(message, type);
    setTimeout(() => setShowToast(null), 3000);
  };
  const [invoiceCounter, setInvoiceCounter] = useState(1);
  const [orderNumber, setOrderNumber] = useState('1');
  const [orderTime, setOrderTime] = useState(new Date());
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });

  // Admin States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productHasSizes, setProductHasSizes] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Invoice Management States
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('');
  const [invoiceCashierFilter, setInvoiceCashierFilter] = useState('');
  const [invoicePaymentFilter, setInvoicePaymentFilter] = useState('');
  const [timeframeFilter, setTimeframeFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let filtered = products.filter(p => p.itemType !== 'internal');

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (query) {
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(query) || p.barcode.includes(query)
      );
    }

    // Sort by salesCount (descending)
    return [...filtered].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
  }, [searchQuery, products, selectedCategory]);

  const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);

  // Handle adding product
  const addToOrder = React.useCallback((product: Product, size?: 'S' | 'M' | 'L') => {
    // If product has sizes and no size is selected yet, open size modal
    if (product.hasSizes && !size) {
      setSelectedProductForSize(product);
      setIsSizeModalOpen(true);
      return;
    }

    const itemPrice = size && product.prices ? (product.prices as any)[size] : product.price;

    setOrderItems((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.size === size);
      if (existing) {
        setLastAction(product.id);
        return prev.map((item) =>
          (item.id === product.id && item.size === size) ? { ...item, quantity: item.quantity + (isReturnMode ? -1 : 1) } : item
        );
      }
      setLastAction(product.id);
      return [...prev, { ...product, quantity: isReturnMode ? -1 : 1, size, price: itemPrice, discount: 0, note: '' }];
    });

    setIsSizeModalOpen(false);
    setSelectedProductForSize(null);
  }, [isReturnMode]);

  const undoLastItem = () => {
    if (!lastAction) return;
    setOrderItems(prev => {
      const item = prev.find(i => i.id === lastAction);
      if (!item) return prev;
      if (item.quantity > 1) {
        return prev.map(i => i.id === lastAction ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== lastAction);
    });
    setLastAction(null);
  };

  const duplicateItem = (item: OrderItem) => {
    setOrderItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
  };

  const updateItem = (id: string, size: string | undefined, updates: Partial<OrderItem>) => {
    setOrderItems(prev => prev.map(item => (item.id === id && item.size === size) ? { ...item, ...updates } : item));
  };

  const updateQuantity = (id: string, size: string | undefined, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.id === id && item.size === size) {
          const newQty = item.quantity + delta;
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeItem = (id: string, size: string | undefined) => {
    setOrderItems((prev) => prev.filter((item) => !(item.id === id && item.size === size)));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const price = item.manualPrice ?? item.price;
      const itemTotal = (price * item.quantity) - (item.discount || 0);
      return sum + itemTotal;
    }, 0);
  }, [orderItems]);

  const total = subtotal - globalDiscount;
  
  const splitTotalPaid = useMemo(() => {
    return (Object.values(splitPayments) as string[]).reduce((sum, val) => sum + parseFloat(val || '0'), 0);
  }, [splitPayments]);

  const change = useMemo(() => {
    if (paymentMethod === 'Cash') {
      const paid = cashAmount === '' ? total : parseFloat(cashAmount);
      return Math.max(0, paid - total);
    }
    if (paymentMethod === 'Split') {
      return Math.max(0, splitTotalPaid - total);
    }
    return 0;
  }, [paymentMethod, cashAmount, total, splitTotalPaid]);

  const remainingToPay = Math.max(0, total - (paymentMethod === 'Split' ? splitTotalPaid : 0));

  useEffect(() => {
    if (settings.lastOrderNumber !== undefined) {
      setOrderNumber((settings.lastOrderNumber + 1).toString());
    }
  }, [settings.lastOrderNumber]);

  const incrementOrderNumber = async () => {
    const newLast = (settings.lastOrderNumber || 0) + 1;
    await updateSettings({ lastOrderNumber: newLast });
  };

  // Order Controls
  const clearOrder = () => {
    setOrderItems([]);
    setGlobalDiscount(0);
    setCustomerName('');
    setOrderTime(new Date());
    setLastAction(null);
    setPaymentMethod('Cash');
  };

  const handleOpenRegister = async (openingCash: number, notes: string) => {
    const newSession: RegisterSession = {
      id: Math.random().toString(36).substring(2, 11),
      openingCash,
      openingTime: new Date().toISOString(),
      notes,
      status: 'Open',
      userId: currentUser?.id || 'admin-1',
      userName: currentUser?.name || 'مدير النظام'
    };

    try {
      await setDoc(doc(db, 'sessions', newSession.id), newSession);
      setIsOpenRegisterOpen(false);
      setInvoiceCounter(1);
      setShowToast('تم فتح الصندوق بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${newSession.id}`);
    }
  };

  const calculateRegisterSummary = (session: RegisterSession) => {
    const sessionInvoices = invoices.filter(inv => {
      // 1. Explicit ID match
      if (inv.sessionId === session.id) return true;
      
      // 2. Date range match (backup if sessionId is missing)
      try {
        if (!inv.date) return false;
        const invDate = new Date(inv.date);
        const openTime = new Date(session.openingTime);
        const closeTime = session.closingTime ? new Date(session.closingTime) : null;
        
        return invDate >= openTime && (!closeTime || invDate <= closeTime);
      } catch (e) {
        return false;
      }
    });

    const summary = {
      invoiceCount: sessionInvoices.filter(inv => inv.status !== 'Cancelled' && inv.status !== 'Held').length,
      cashSales: 0,
      cardSales: 0,
      mixedSales: 0,
      totalSales: 0,
      refunds: 0,
      cashRefunds: 0,
      cardRefunds: 0,
      mixedRefunds: 0
    };

    sessionInvoices.forEach(inv => {
      if (inv.status === 'Cancelled' || inv.status === 'Held') return;

      // Calculate original total (before any refunds)
      const originalTotal = inv.total;
      
      // Calculate total refunded amount for this invoice
      const refundedAmount = (inv.refundedItems || []).reduce((sum, ri) => {
        const item = inv.items.find(i => i.id === ri.productId);
        const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
        return sum + (itemPrice * ri.quantity);
      }, 0);

      summary.totalSales += originalTotal;
      summary.refunds += refundedAmount;

      // Distribute sales and refunds by payment method
      if (inv.paymentMethod === 'Cash') {
        summary.cashSales += originalTotal;
        summary.cashRefunds += refundedAmount;
      } else if (inv.paymentMethod === 'Card') {
        summary.cardSales += originalTotal;
        summary.cardRefunds += refundedAmount;
      } else if (inv.paymentMethod === 'Wallet') {
        summary.mixedSales += originalTotal;
        summary.mixedRefunds += refundedAmount;
      } else if (inv.paymentMethod === 'Split') {
        // For split payments, we assume refunds are taken proportionally or just from cash first?
        // Let's assume proportional for now, or just track the payments
        inv.payments.forEach(p => {
          const ratio = originalTotal > 0 ? p.amount / originalTotal : 0;
          const pRefund = refundedAmount * ratio;
          
          if (p.method === 'Cash') {
            summary.cashSales += p.amount;
            summary.cashRefunds += pRefund;
          } else if (p.method === 'Card') {
            summary.cardSales += p.amount;
            summary.cardRefunds += pRefund;
          } else {
            summary.mixedSales += p.amount;
            summary.mixedRefunds += pRefund;
          }
        });
      }
    });

    return summary;
  };

  const [registerSummary, setRegisterSummary] = useState<any>(null);

  const handleCloseRegister = async (closingCash: number, notes: string, summary: any) => {
    if (!activeSession) return;

    const expectedCash = activeSession.openingCash + (summary.cashSales || 0) - (summary.cashRefunds || 0);
    const difference = closingCash - expectedCash;

    const closedSession: RegisterSession = {
      ...activeSession,
      closingTime: new Date().toISOString(),
      closingCash,
      expectedCash,
      difference,
      notes,
      status: 'Closed'
    };

    try {
      await setDoc(doc(db, 'sessions', closedSession.id), closedSession);
      setIsCloseRegisterOpen(false);
      setInvoiceCounter(1);
      
      try {
        await updateDoc(doc(db, 'settings', 'config'), { lastOrderNumber: 0 });
      } catch (err) {
        console.error('Could not reset order number:', err);
      }
      
      setShowToast('تم إغلاق الصندوق بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${closedSession.id}`);
    }
  };

  const handleViewSession = (session: RegisterSession) => {
    const summary = calculateRegisterSummary(session);
    setViewingSession(session);
    setViewingSessionSummary(summary);
  };

  const holdOrder = async () => {
    if (orderItems.length === 0) return;
    
    const invoice: Invoice = {
      id: Date.now().toString(),
      orderNumber: orderNumber,
      date: new Date().toISOString(),
      items: [...orderItems],
      subtotal,
      discount: globalDiscount,
      total,
      paymentMethod: 'Cash',
      payments: [],
      cashierName: currentUser?.name || 'غير معروف',
      cashierId: currentUser?.id || 'unknown',
      customerName,
      status: 'Held',
      sessionId: activeSession?.id
    };
    
    const newHeld: HeldOrder = {
      id: invoice.id,
      items: [...orderItems],
      date: new Date().toISOString(),
      customerName,
      userId: currentUser?.id || 'unknown'
    };
    
    try {
      await setDoc(doc(db, 'invoices', invoice.id), invoice);
      await setDoc(doc(db, 'heldOrders', newHeld.id), newHeld);
      await incrementOrderNumber();
      clearOrder();
      setShowToast('تم تعليق الطلب بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      setShowToast('حدث خطأ أثناء تعليق الطلب. يرجى المحاولة مرة أخرى.', 'error');
      setTimeout(() => setShowToast(null), 3000);
      handleFirestoreError(error, OperationType.WRITE, `heldOrders/${newHeld.id}`);
    }
  };

  const resumeOrder = async (held: HeldOrder) => {
    try {
      setOrderItems(held.items);
      setCustomerName(held.customerName || '');
      await deleteDoc(doc(db, 'heldOrders', held.id));
      await deleteDoc(doc(db, 'invoices', held.id));
      setIsHeldOrdersOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `heldOrders/${held.id}`);
    }
  };

  const cancelOrder = async () => {
    if (orderItems.length === 0) return;
    
    const invoice: Invoice = {
      id: Date.now().toString(),
      orderNumber: orderNumber,
      date: new Date().toISOString(),
      items: [...orderItems],
      subtotal,
      discount: globalDiscount,
      total,
      paymentMethod: 'Cash',
      payments: [],
      cashierName: currentUser?.name || 'غير معروف',
      cashierId: currentUser?.id || 'unknown',
      customerName,
      status: 'Cancelled',
      sessionId: activeSession?.id
    };
    
    try {
      await setDoc(doc(db, 'invoices', invoice.id), invoice);
      incrementOrderNumber();
      clearOrder();
      setShowToast('تم إلغاء الطلب وحفظه في السجل');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `invoices/${invoice.id}`);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || (!editingProduct && !isProductModalOpen)) return;
    
    setIsLoading(true);
    const productData: Product = {
      id: editingProduct?.id || `prod-${Math.random().toString(36).substring(2, 11)}`,
      name: editingProduct?.name || '',
      barcode: editingProduct?.barcode || '',
      category: editingProduct?.category || '',
      price: productHasSizes ? 0 : (editingProduct?.price || 0),
      hasSizes: productHasSizes,
      ...(productHasSizes ? {
        prices: {
          S: editingProduct?.prices?.S || 0,
          M: editingProduct?.prices?.M || 0,
          L: editingProduct?.prices?.L || 0,
        }
      } : {}),
      purchasePrice: editingProduct?.purchasePrice || 0,
      stock: editingProduct?.stock || 0,
      minStock: editingProduct?.minStock || 0,
      image: imagePreview || editingProduct?.image || 'https://picsum.photos/seed/product/400/400',
      status: editingProduct?.status || 'available',
      salesCount: editingProduct?.salesCount || 0,
      itemType: editingProduct?.itemType || 'sellable'
    };

    const isDuplicateName = products.some(p => p.name === productData.name && p.id !== productData.id);
    if (isDuplicateName) {
      setShowToast('يوجد منتج بنفس الاسم مسبقاً');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    try {
      await setDoc(doc(db, 'products', productData.id), productData);
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setImagePreview(null);
      setShowToast(editingProduct ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${productData.id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setShowToast('حجم الصورة كبير جداً (الحد الأقصى 2MB)');
        setTimeout(() => setShowToast(null), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !editingCategory) return;
    
    setIsLoading(true);
    const categoryData: Category = {
      id: editingCategory.id || `cat-${Math.random().toString(36).substring(2, 11)}`,
      name: editingCategory.name,
      icon: editingCategory.icon
    };

    const isDuplicateName = categories.some(c => c.name === categoryData.name && c.id !== categoryData.id);
    if (isDuplicateName) {
      setShowToast('يوجد تصنيف بنفس الاسم مسبقاً');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    try {
      const existingCategory = categories.find(c => c.id === categoryData.id);
      if (existingCategory && existingCategory.name !== categoryData.name) {
        // Update products in Firestore that have this category
        const productsToUpdate = products.filter(p => p.category === existingCategory.name);
        for (const p of productsToUpdate) {
          await updateDoc(doc(db, 'products', p.id), { category: categoryData.name });
        }
      }

      await setDoc(doc(db, 'categories', categoryData.id), categoryData);
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setShowToast(editingCategory.id ? 'تم تحديث التصنيف بنجاح' : 'تم إضافة التصنيف بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `categories/${categoryData.id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف فاتورة',
      message: 'هل أنت متأكد من حذف هذه الفاتورة نهائياً؟ لا يمكن التراجع عن هذه العملية وسيتم حذفها من جميع التقارير.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setIsLoading(true);
          await deleteDoc(doc(db, 'invoices', invoiceId));
          setShowToast('تم حذف الفاتورة بنجاح');
          setTimeout(() => setShowToast(null), 3000);
        } catch (error) {
          console.error('Error deleting invoice:', error);
          handleFirestoreError(error, OperationType.DELETE, `invoices/${invoiceId}`);
          setShowToast('فشل حذف الفاتورة', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleRefund = async (invoiceId: string) => {
    if (!selectedInvoice) return;

    const itemsToRefund = Object.entries(refundQuantities)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([productId, qty]) => ({
        productId,
        quantity: qty as number
      }));

    if (itemsToRefund.length === 0) {
      setShowToast('يرجى اختيار منتج واحد على الأقل للإرجاع');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    // Check if it's a full or partial refund
    const totalItemsInInvoice = selectedInvoice.items.reduce((acc, item) => acc + item.quantity, 0);
    const totalRefundedSoFar = (selectedInvoice.refundedItems || []).reduce((acc, item) => acc + item.quantity, 0);
    const totalBeingRefunded = itemsToRefund.reduce((acc, item) => acc + (item.quantity as number), 0);
    
    const isFullRefund = (totalRefundedSoFar + totalBeingRefunded) === totalItemsInInvoice;
    const status: InvoiceStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';

    const updatedInvoice: Invoice = {
      ...selectedInvoice,
      status,
      refundReason,
      refundDate: new Date().toISOString(),
      refundedItems: [...(selectedInvoice.refundedItems || []), ...itemsToRefund]
    };

    try {
      await setDoc(doc(db, 'invoices', invoiceId), updatedInvoice);
      
      // Update stock for refunded items
      const stockPromises = itemsToRefund.map(async (item) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await updateDoc(doc(db, 'products', product.id), {
            stock: (product.stock || 0) + item.quantity
          });
        }
      });
      await Promise.all(stockPromises);

      if (isPrintingRefund) {
        setTimeout(() => triggerReceiptPrint(updatedInvoice, false, settings), 200);
      }

      setIsRefundModalOpen(false);
      setSelectedInvoice(null);
      setRefundReason('');
      setRefundQuantities({});
      setIsPrintingRefund(false);
      setShowToast('تمت عملية الإرجاع بنجاح');
      
      // Navigate to returns log
      setCurrentView('admin');
      setAdminSubView('returns');
      
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `invoices/${invoiceId}`);
    }
  };

  const handleKitchenPrint = () => {
    try {
      // 1. Check if there is a current order
      if (orderItems.length === 0) {
        setShowToast('لا يوجد طلب للطباعة', 'error');
        console.warn('Kitchen Print Attempted: No items in order');
        return;
      }

      // 2. Check if kitchen printer is specified in settings
      if (!settings.kitchenPrinterName || settings.kitchenPrinterName === 'None') {
        setShowToast('لم يتم تحديد طابعة المطبخ في الإعدادات', 'error');
        console.warn('Kitchen Print Attempted: Kitchen printer not specified in settings');
        return;
      }

      // 3. Prepare data for kitchen print
      const kitchenData = {
        orderNumber: orderNumber,
        timestamp: new Date().toISOString(),
        cashierName: currentUser?.name || 'غير معروف',
        items: orderItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          size: item.size,
          note: item.note
        })),
        notes: '' // General notes if needed
      };

      // 4. Trigger print using PrintStudio
      // We use autoPrint: true to trigger the print dialog immediately
      triggerKitchenPrint(kitchenData, true, settings);
      
      console.log(`Kitchen print triggered successfully for order: ${orderNumber} using printer: ${settings.kitchenPrinterName}`);
    } catch (error) {
      console.error('Error in handleKitchenPrint:', error);
      setShowToast('فشل في إرسال الطلب للمطبخ', 'error');
    }
  };

  const isInvoiceInTimeframe = (invDate: string | undefined, dateFilter: string, timeframe: string) => {
    if (!invDate) return false;
    
    // Normal date filter match
    let matches = !dateFilter || invDate.startsWith(dateFilter);
    if (!matches) return false;

    // Timeframe filter match
    if (timeframe !== 'all') {
      const date = new Date(invDate);
      const now = new Date();
      
      if (timeframe === 'daily') {
        matches = date.toDateString() === now.toDateString();
      } else if (timeframe === 'weekly') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        matches = date >= oneWeekAgo;
      } else if (timeframe === 'monthly') {
        matches = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      } else if (timeframe === 'yearly') {
        matches = date.getFullYear() === now.getFullYear();
      }
    }
    
    return matches;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const orderNo = String(inv.orderNumber || '').toLowerCase();
      const custName = String(inv.customerName || '').toLowerCase();
      const search = invoiceSearchQuery.toLowerCase();
      
      const matchesSearch = orderNo.includes(search) || custName.includes(search);
      const matchesDate = isInvoiceInTimeframe(inv.date, invoiceDateFilter, timeframeFilter);
      const matchesCashier = !invoiceCashierFilter || inv.cashierName === invoiceCashierFilter;
      const matchesPayment = !invoicePaymentFilter || inv.paymentMethod === invoicePaymentFilter;
      return matchesSearch && matchesDate && matchesCashier && matchesPayment;
    });
  }, [invoices, invoiceSearchQuery, invoiceDateFilter, invoiceCashierFilter, invoicePaymentFilter, timeframeFilter]);

  const fixMalformedInvoices = async () => {
    try {
      const suspiciousInvoices = invoices.filter(inv => {
        const date = new Date(inv.date);
        const year = date.getFullYear();
        return isNaN(date.getTime()) || year < 2024 || year > 2026;
      });

      if (suspiciousInvoices.length === 0) {
        triggerToast('لم يتم العثور على فواتير بتواريخ غير منطقية', 'success');
        return;
      }

      setConfirmDialog({
        isOpen: true,
        title: 'إصلاح الفواتير',
        message: `تم العثور على ${suspiciousInvoices.length} فاتورة بتواريخ غير منطقية. هل تريد تعيين تاريخها إلى اليوم؟`,
        type: 'warning',
        onConfirm: async () => {
          try {
            const now = new Date().toISOString();
            for (const inv of suspiciousInvoices) {
              await updateDoc(doc(db, 'invoices', inv.id), { 
                date: now,
                updatedAt: now 
              });
            }
            triggerToast(`تم إصلاح ${suspiciousInvoices.length} فاتورة بنجاح`, 'success');
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'invoices');
          }
        }
      });
    } catch (error) {
      console.error('Error fixing invoices:', error);
      triggerToast('حدث خطأ أثناء محاولة إصلاح الفواتير', 'error');
    }
  };

  const handleCheckout = async (shouldPrint: boolean) => {
    if (isLoading) return;
    setIsLoading(true);
    
    if (!activeSession) {
      setShowToast('يجب فتح الصندوق أولاً قبل إتمام عملية البيع');
      setTimeout(() => setShowToast(null), 3000);
      setIsOpenRegisterOpen(true);
      setIsLoading(false);
      return;
    }

    let payments: { method: PaymentMethod; amount: number }[] = [];
    let finalCashPaid = 0;

    if (paymentMethod === 'Cash') {
      const paid = cashAmount === '' ? total : parseFloat(cashAmount);
      payments.push({ method: 'Cash', amount: total });
      finalCashPaid = paid;
    } else if (paymentMethod === 'Card') {
      payments.push({ method: 'Card', amount: total });
      finalCashPaid = total;
    } else if (paymentMethod === 'Wallet') {
      payments.push({ method: 'Wallet', amount: total });
      finalCashPaid = total;
    } else if (paymentMethod === 'Split') {
      (Object.entries(splitPayments) as [string, string][]).forEach(([method, amount]) => {
        const val = parseFloat(amount || '0');
        if (val > 0) {
          payments.push({ method: method as PaymentMethod, amount: val });
        }
      });
      finalCashPaid = parseFloat(splitPayments.Cash || '0');
    }

    const invoice: Invoice = {
      id: Date.now().toString(),
      orderNumber: orderNumber,
      date: new Date().toISOString(),
      items: orderItems.map(item => {
        const { manualPrice, ...rest } = item;
        return {
          ...rest,
          price: manualPrice !== undefined ? manualPrice : item.price
        };
      }),
      subtotal,
      discount: globalDiscount,
      total,
      paymentMethod,
      payments,
      cashierName: currentUser?.name || 'غير معروف',
      cashierId: currentUser?.id || 'unknown',
      customerName: customerName || '',
      cashPaid: finalCashPaid,
      change: change || 0,
      status: isReturnMode ? 'Refunded' : 'Paid',
      sessionId: activeSession.id
    };

    const effectiveShouldPrint = shouldPrint || settings.autoPrintAfterPayment;

    try {
      await setDoc(doc(db, 'invoices', invoice.id), invoice);
      
      // Update salesCount and stock for products in Firestore
      for (const item of invoice.items) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          await updateDoc(doc(db, 'products', product.id), {
            salesCount: (product.salesCount || 0) + item.quantity,
            stock: (product.stock || 0) - item.quantity
          });
        }
      }

      await incrementOrderNumber();
      setLastInvoice(invoice);
      
      if (isReturnMode) {
        setIsPrintingRefund(true);
      } else {
        setIsPrintingRefund(false);
      }

      if (effectiveShouldPrint) {
        setTimeout(() => {
          triggerReceiptPrint(invoice, settings.autoPrintAfterPayment, settings);
          setIsCheckoutOpen(false);
          clearOrder();
          setPaymentMethod('Cash');
          setCashAmount('');
          setSplitPayments({ Cash: '', Card: '', Wallet: '' });
          setShowToast('تمت العملية بنجاح');
          setTimeout(() => setShowToast(null), 3000);
        }, 300);
      } else {
        setIsCheckoutOpen(false);
        clearOrder();
        setPaymentMethod('Cash');
        setCashAmount('');
        setSplitPayments({ Cash: '', Card: '', Wallet: '' });
        setShowToast('تمت العملية بنجاح');
        setTimeout(() => setShowToast(null), 3000);
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setShowToast('حدث خطأ أثناء إتمام العملية. يرجى المحاولة مرة أخرى.', 'error');
      setTimeout(() => setShowToast(null), 3000);
      handleFirestoreError(error, OperationType.WRITE, `invoices/${invoice.id}`);
    }
  };

  const printLastInvoice = () => {
    if (lastInvoice) {
      window.print();
    }
  };

  // Initialize order number on mount
  useEffect(() => {
    if (settings.lastOrderNumber !== undefined) {
      setOrderNumber((settings.lastOrderNumber + 1).toString());
    }
  }, [settings.lastOrderNumber]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (orderItems.length > 0) setIsCheckoutOpen(true);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        // Focus global discount or something
        setShowToast('يرجى إدخال الخصم في قسم الطلب');
        setTimeout(() => setShowToast(null), 2000);
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        printLastInvoice();
      }
      if (e.key === 'Escape') {
        if (isCheckoutOpen) setIsCheckoutOpen(false);
        else if (isHeldOrdersOpen) setIsHeldOrdersOpen(false);
        else if (isItemEditOpen) setIsItemEditOpen(null);
        else if (orderItems.length > 0) {
          setConfirmDialog({
            isOpen: true,
            title: 'إلغاء الطلب',
            message: 'هل أنت متأكد من رغبتك في إلغاء الطلب الحالي؟',
            type: 'danger',
            onConfirm: cancelOrder
          });
        }
      }
      if (e.key === 'Enter' && isCheckoutOpen) {
        // Handled inside modal for specific inputs, but global enter could confirm
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderItems.length, lastInvoice, isCheckoutOpen, isHeldOrdersOpen, isItemEditOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const exactMatch = products.find(p => p.barcode === searchQuery && p.itemType !== 'internal');
      if (exactMatch) {
        addToOrder(exactMatch);
        setSearchQuery('');
      } else if (filteredProducts.length === 1 && searchQuery.length > 2) {
        addToOrder(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const [isManualLogin, setIsManualLogin] = useState(false);

  const handleResetPassword = async () => {
    if (!loginEmail) {
      setShowToast('يرجى إدخال البريد الإلكتروني أولاً لإعادة تعيين كلمة المرور', 'error');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail.trim());
      setShowToast('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error: any) {
      console.error("Reset password error:", error);
      setShowToast('حدث خطأ أثناء إرسال رابط إعادة التعيين', 'error');
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      setShowToast('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      // Auth listener will handle state update
      setShowToast('تم تسجيل الدخول بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error: any) {
      console.error("Login error:", error);
      let message = 'خطأ في تسجيل الدخول. يرجى التأكد من البيانات.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'كلمة المرور غير صحيحة، أو أن هذا الحساب قديم ويحتاج إلى حذفه وإعادة إضافته من لوحة التحكم.';
      }
      setShowToast(message);
      setTimeout(() => setShowToast(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowToast('تم تسجيل الدخول بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error: any) {
      console.error("Google login error:", error);
      setShowToast('فشل تسجيل الدخول باستخدام Google');
      setTimeout(() => setShowToast(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAndImport = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'إعادة ضبط النظام واستيراد البيانات الجديدة',
      message: 'سيتم مسح جميع البيانات الحالية (المنتجات، الأقسام، الفواتير) واستيراد القائمة الجديدة. هل أنت متأكد؟',
      type: 'danger',
      onConfirm: () => {
        // 1. Reset all local state
        setInvoices([]);
        setHeldOrders([]);
        setPurchases([]);
        setExpenses([]);
        setRegisterHistory([]);
        setActiveSession(null);

        // 2. Import Categories
        setCategories(initialCategories);

        // 3. Import Products
        const importedProducts = initialProducts.map((prod: any) => ({
          ...prod,
          id: prod.id || Math.random().toString(36).substring(2, 11),
          price: prod.prices?.M || prod.price || 0,
          purchasePrice: 0,
          stock: 0,
          stocks: { S: 0, M: 0, L: 0 },
          minStock: 10,
          status: 'available'
        }));
        setProducts(importedProducts);

        setShowToast('تمت إعادة الضبط واستيراد البيانات بنجاح');
        setTimeout(() => setShowToast(null), 3000);
      }
    });
  };
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Auth listener will handle state update
      clearOrder();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = (formData.get('email') as string).trim();
    const password = formData.get('password') as string;
    
    try {
      let uid = editingUser?.id;
      const isNewUser = !uid;
      
      // Try to create in Firebase Auth if password is provided and it's a new user
      if (password && isNewUser) {
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          uid = userCredential.user.uid;
          await signOut(secondaryAuth);
        } catch (authError: any) {
          throw authError; // We must throw this so the user knows the email is taken
        }
      }

      const userData: UserType = {
        id: uid || Date.now().toString(),
        name: formData.get('name') as string,
        email: email,
        role: formData.get('role') as UserRole,
        createdAt: editingUser?.createdAt || new Date().toISOString(),
        isHidden: formData.get('isHidden') === 'on'
      };
      
      if (password) {
        userData.password = password;
      } else if (editingUser?.password) {
        userData.password = editingUser.password;
      }

      await setDoc(doc(db, 'users', userData.id), userData);
      setIsUserModalOpen(false);
      setEditingUser(null);
      setShowToast(!isNewUser ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error: any) {
      console.error("Error saving user:", error);
      if (error.code === 'auth/email-already-in-use') {
        setShowToast('البريد الإلكتروني مستخدم بالفعل', 'error');
      } else if (error.code === 'auth/weak-password') {
        setShowToast('كلمة المرور ضعيفة جداً', 'error');
      } else {
        setShowToast('حدث خطأ أثناء حفظ المستخدم', 'error');
      }
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const deleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      setShowToast('لا يمكنك حذف حسابك الحالي');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', id));
      setShowToast('تم حذف المستخدم بنجاح');
      setTimeout(() => setShowToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-avocado-bg flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-avocado-primary/20 flex flex-col"
        >
          <div className="p-8 flex flex-col items-center border-b border-stone-100 bg-avocado-dark text-white">
            <div className="w-20 h-20 flex items-center justify-center mb-4">
              <img src={settings.storeLogo || "https://res.cloudinary.com/dxziybs9n/image/upload/v1772234203/logo_avocados_2_c1mbav.png"} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-2xl font-black">{settings.storeName || "Avocados Cafe"}</h1>
            <p className="text-avocado-light/60 text-xs mt-1">نظام إدارة المبيعات المتطور</p>
          </div>

          <div className="p-8 flex flex-col justify-center bg-white">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-avocado-dark">تسجيل الدخول</h2>
              <p className="text-stone-500 text-sm mt-1">
                {isManualLogin ? 'أدخل البريد الإلكتروني وكلمة المرور' : selectedLoginUser ? `مرحباً ${selectedLoginUser.name}، أدخل كلمة المرور` : 'اختر المستخدم للمتابعة'}
              </p>
            </div>

            {isManualLogin ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600 block">البريد الإلكتروني</label>
                  <input 
                    name="email"
                    type="email" 
                    required
                    autoFocus
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-avocado-bg/30 border border-avocado-primary/20 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-stone-600 block">كلمة المرور</label>
                    <button 
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs text-avocado-primary hover:underline font-bold"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <Settings className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                    <input 
                      name="password"
                      type="password" 
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10 pl-4 py-3 bg-avocado-bg/30 border border-avocado-primary/20 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className={`flex-1 bg-avocado-btn text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-avocado-primary/20 hover:bg-avocado-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري التحقق...
                      </>
                    ) : 'تسجيل الدخول'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsManualLogin(false);
                      setLoginEmail('');
                      setLoginPassword('');
                    }}
                    className="px-6 bg-stone-100 text-stone-600 py-4 rounded-xl font-bold hover:bg-stone-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : !selectedLoginUser ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {users
                    .filter(u => u.email !== 'mohammadalmasri950@gmail.com' && !u.isHidden)
                    .filter((user, index, self) => index === self.findIndex((t) => t.email === user.email))
                    .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedLoginUser(user);
                        setLoginEmail(user.email);
                        setLoginPassword('');
                      }}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-stone-100 hover:border-avocado-primary hover:bg-avocado-bg/20 transition-all text-right group"
                    >
                      <div className="w-12 h-12 rounded-full bg-avocado-bg flex items-center justify-center text-avocado-dark font-bold text-xl group-hover:bg-avocado-primary group-hover:text-white transition-colors">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-black text-stone-800">{user.name}</div>
                        <div className="text-xs text-stone-500">{user.role === 'Admin' ? 'مدير النظام' : user.role === 'Manager' ? 'مشرف' : 'كاشير'}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-avocado-primary" />
                    </button>
                  ))}
                </div>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-stone-500">أو</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-3 bg-white border border-stone-200 text-stone-700 py-3 rounded-xl font-bold hover:bg-stone-50 transition-all active:scale-[0.98] shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    جوجل
                  </button>
                  <button
                    onClick={() => {
                      setIsManualLogin(true);
                      setLoginEmail('');
                      setLoginPassword('');
                    }}
                    className="flex-1 bg-stone-100 text-stone-700 py-3 rounded-xl font-bold hover:bg-stone-200 transition-all active:scale-[0.98]"
                  >
                    إدخال يدوي
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-avocado-bg/20 border border-avocado-primary/10 mb-2">
                  <div className="w-12 h-12 rounded-full bg-avocado-primary flex items-center justify-center text-white font-bold text-xl">
                    {selectedLoginUser.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-stone-800">{selectedLoginUser.name}</div>
                    <div className="text-xs text-stone-500">{selectedLoginUser.email}</div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedLoginUser(null)}
                    className="text-avocado-primary text-xs font-bold hover:underline"
                  >
                    تغيير
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-stone-600 block">كلمة المرور</label>
                    <button 
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs text-avocado-primary hover:underline font-bold"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <Settings className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                    <input 
                      name="password"
                      type="password" 
                      required
                      autoFocus
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-10 pl-4 py-3 bg-avocado-bg/30 border border-avocado-primary/20 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  disabled={isLoading}
                  className={`w-full bg-avocado-btn text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-avocado-primary/20 hover:bg-avocado-primary transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحقق...
                    </>
                  ) : 'تسجيل الدخول'}
                </button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-stone-100">
              <p className="text-[10px] text-stone-400 text-center">Avocados POS v2.0 - جميع الحقوق محفوظة</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-100 font-sans text-stone-900 overflow-hidden" dir="rtl">
      {/* Main App Sidebar (Navigation) */}
      <aside className="w-16 md:w-20 bg-avocado-dark flex flex-col items-center py-4 md:py-8 gap-4 md:gap-8 z-[60] print:hidden shrink-0">
        <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
          <img src={settings.storeLogo || "https://res.cloudinary.com/dxziybs9n/image/upload/v1772234203/logo_avocados_2_c1mbav.png"} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
        </div>
        
        <nav className="flex flex-col gap-3 md:gap-4">
          <button 
            onClick={() => setCurrentView('pos')}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'pos' ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-dark/20' : 'text-avocado-light/50 hover:bg-avocado-primary/20 hover:text-white'}`}
            title="شاشة البيع"
          >
            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <button 
            onClick={() => setCurrentView('my-sales')}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'my-sales' ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-dark/20' : 'text-avocado-light/50 hover:bg-avocado-primary/20 hover:text-white'}`}
            title="مبيعاتي"
          >
            <FileText className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <button 
            onClick={() => setCurrentView('expenses')}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'expenses' ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-dark/20' : 'text-avocado-light/50 hover:bg-avocado-primary/20 hover:text-white'}`}
            title="المصاريف"
          >
            <DollarSign className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <button 
            onClick={() => {
              if (activeSession) {
                const summary = calculateRegisterSummary(activeSession);
                setRegisterSummary(summary);
                setIsCloseRegisterOpen(true);
              } else {
                setIsOpenRegisterOpen(true);
              }
            }}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${activeSession ? 'bg-green-600 text-white' : 'text-avocado-light/50 hover:bg-avocado-primary/20 hover:text-white'}`}
            title={activeSession ? 'إغلاق الصندوق' : 'فتح الصندوق'}
          >
            <Calculator className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <button 
            onClick={() => setCurrentView('admin')}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'admin' ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-dark/20' : 'text-avocado-light/50 hover:bg-avocado-primary/20 hover:text-white'}`}
            title="الإدارة"
          >
            <Settings className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-avocado-secondary flex items-center justify-center text-avocado-light font-bold text-[10px] md:text-xs" title={currentUser?.name}>
            {currentUser?.name.substring(0, 2)}
          </div>
          <button 
            onClick={handleLogout}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-stone-500 hover:bg-red-900/20 hover:text-red-500 transition-all"
            title="تسجيل الخروج"
          >
            <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </aside>

      {currentView === 'pos' ? (
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden print:hidden">
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-stone-200 p-3 md:p-4 flex flex-col gap-3 md:gap-4 sticky top-0 z-10 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 md:gap-6 overflow-x-auto no-scrollbar w-full sm:w-auto">
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] md:text-[10px] text-stone-400 uppercase font-bold tracking-wider">رقم الطلب</span>
                <span className="font-black text-avocado-primary text-sm md:text-base">{orderNumber}</span>
              </div>
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] md:text-[10px] text-stone-400 uppercase font-bold tracking-wider">وقت البدء</span>
                <span className="font-bold text-sm md:text-base">{orderTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex flex-col shrink-0">
                <span className="text-[9px] md:text-[10px] text-stone-400 uppercase font-bold tracking-wider">الكاشير</span>
                <span className="font-bold text-stone-700 text-sm md:text-base truncate max-w-[100px] md:max-w-none">{currentUser?.name}</span>
              </div>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <button 
                onClick={undoLastItem}
                disabled={!lastAction}
                className="flex items-center gap-2 bg-stone-50 text-stone-700 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors disabled:opacity-50 whitespace-nowrap text-sm"
              >
                <Ban className="w-4 h-4" />
                <span>تراجع</span>
              </button>
              <button 
                onClick={() => setIsHeldOrdersOpen(true)}
                className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap text-sm"
              >
                <History className="w-4 h-4 md:w-5 md:h-5" />
                <span className="font-bold">{heldOrders.length} معلق</span>
              </button>
              <button 
                onClick={printLastInvoice}
                disabled={!lastInvoice}
                className="flex items-center gap-2 bg-stone-50 text-stone-700 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors disabled:opacity-50 whitespace-nowrap text-sm"
              >
                <Printer className="w-4 h-4 md:w-5 md:h-5" />
                <span>طباعة (Ctrl+P)</span>
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4 md:w-5 md:h-5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="البحث بالاسم أو الباركود (Ctrl+F)..."
              className="w-full pr-9 md:pr-10 pl-4 py-2 md:py-3 bg-stone-50 border border-stone-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all text-base md:text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
        </header>
        
        {/* Category Filter */}
        <div className="px-6 py-2 bg-white border-b border-stone-200 overflow-x-auto flex gap-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-6 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${selectedCategory === 'All' ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            الكل
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-6 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${selectedCategory === cat.name ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-light' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <ProductGrid products={filteredProducts} onProductClick={addToOrder} settings={settings} />
        </div>

        {/* Bottom Quick Controls */}
        <div className="bg-white border-t border-stone-200 p-4 flex gap-4">
          <button 
            onClick={() => {
              if (orderItems.length > 0) {
                setConfirmDialog({
                  isOpen: true,
                  title: 'إلغاء الطلب',
                  message: 'هل أنت متأكد من رغبتك في إلغاء الطلب الحالي ومسح كافة الأصناف؟',
                  type: 'danger',
                  onConfirm: cancelOrder
                });
              }
            }} 
            className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold border border-red-100 hover:bg-red-100 flex items-center justify-center gap-2"
          >
            <Ban className="w-5 h-5" /> إلغاء الطلب
          </button>
          <button onClick={holdOrder} className="flex-1 bg-amber-50 text-amber-600 py-3 rounded-xl font-bold border border-amber-100 hover:bg-amber-100 flex items-center justify-center gap-2">
            <Save className="w-5 h-5" /> تعليق الطلب
          </button>
          <button 
            onClick={() => {
              if (orderItems.length > 0) {
                setConfirmDialog({
                  isOpen: true,
                  title: 'طلب جديد',
                  message: 'بدء طلب جديد سيؤدي لمسح الطلب الحالي، هل أنت متأكد؟',
                  type: 'warning',
                  onConfirm: clearOrder
                });
              } else {
                clearOrder();
              }
            }} 
            className="flex-1 bg-stone-50 text-stone-600 py-3 rounded-xl font-bold border border-stone-200 hover:bg-stone-100 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> طلب جديد
          </button>
        </div>
      </main>

          {/* Sidebar - Current Order */}
          <aside className={`w-full lg:w-[380px] xl:w-[450px] border-r border-stone-200 flex flex-col h-full shadow-2xl z-20 transition-all duration-300 ${isReturnMode ? 'bg-red-50' : 'bg-white'} ${orderItems.length > 0 ? 'flex' : 'hidden lg:flex'}`}>
        <div className={`p-4 md:p-6 border-b border-stone-100 flex items-center justify-between ${isReturnMode ? 'bg-red-100/50' : 'bg-stone-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isReturnMode ? 'bg-red-600 text-white' : 'bg-avocado-primary text-white'}`}>
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-xl">{isReturnMode ? 'طلب مرتجع' : 'الطلب الحالي'}</h2>
              {isReturnMode && <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Return Mode Active</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="اسم العميل..." 
                className="pr-9 pl-3 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-1 focus:ring-avocado-primary outline-none"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orderItems.map((item) => (
            <div key={`${item.id}-${item.size || 'default'}`} className="bg-stone-50 rounded-2xl p-4 border border-stone-100 group relative">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-bold text-stone-800">
                    {item.name}
                    {item.size && <span className="mr-2 text-xs bg-avocado-light text-avocado-secondary px-2 py-0.5 rounded-lg">{item.size}</span>}
                  </h4>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {item.note && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {item.note}</span>}
                    {item.discount && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Tag className="w-3 h-3" /> خصم: {item.discount} {settings.currencySymbol}</span>}
                    {item.manualPrice !== undefined && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">سعر معدل</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-avocado-primary">
                    {((item.manualPrice ?? item.price) * item.quantity - (item.discount || 0)).toFixed(2)} {settings.currencySymbol}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {item.quantity} × {((item.manualPrice ?? item.price) || 0).toFixed(2)} {settings.currencySymbol}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
                  <button onClick={() => updateQuantity(item.id, item.size, -1)} className="p-2 hover:bg-stone-50 text-stone-500"><Minus className="w-4 h-4" /></button>
                  <input 
                    type="number"
                    className="w-12 text-center font-black text-stone-700 border-x border-stone-100 outline-none bg-transparent"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      updateItem(item.id, item.size, { quantity: val });
                    }}
                  />
                  <button onClick={() => updateQuantity(item.id, item.size, 1)} className="p-2 hover:bg-stone-50 text-stone-500"><Plus className="w-4 h-4" /></button>
                </div>

                <div className="flex gap-1">
                  <button onClick={() => duplicateItem(item)} title="تكرار" className="p-2 text-stone-400 hover:text-blue-600 transition-colors"><Plus className="w-5 h-5" /></button>
                  <button onClick={() => setIsItemEditOpen(item.id)} title="تعديل" className="p-2 text-stone-400 hover:text-avocado-primary transition-colors"><MessageSquare className="w-5 h-5" /></button>
                  <button onClick={() => removeItem(item.id, item.size)} title="حذف" className="p-2 text-stone-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Item Edit Overlay */}
              <AnimatePresence>
                {isItemEditOpen === item.id && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute inset-0 bg-white/98 backdrop-blur rounded-2xl p-4 z-10 flex flex-col gap-2 border border-avocado-primary/20 shadow-xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs">تعديل: {item.name}</span>
                      <button onClick={() => setIsItemEditOpen(null)}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-stone-500 block mb-0.5 font-bold">السعر ({settings.currencySymbol})</label>
                        <input type="number" value={item.manualPrice ?? item.price} onChange={(e) => updateItem(item.id, item.size, { manualPrice: parseFloat(e.target.value) || 0 })} className="w-full p-1.5 border border-stone-200 rounded-lg text-xs" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="text-[9px] text-stone-500 block mb-0.5 font-bold">خصم ({settings.currencySymbol})</label>
                        <input type="number" value={item.discount || ''} onChange={(e) => updateItem(item.id, item.size, { discount: parseFloat(e.target.value) || 0 })} className="w-full p-1.5 border border-stone-200 rounded-lg text-xs" placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-stone-500 block mb-0.5 font-bold">ملاحظة</label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {['بدون سكر', 'Extra Shot', 'بدون حليب'].map(opt => (
                          <button 
                            key={opt} 
                            onClick={() => updateItem(item.id, item.size, { note: item.note ? `${item.note}, ${opt}` : opt })}
                            className="text-[8px] bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded border border-stone-200"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={item.note || ''} onChange={(e) => updateItem(item.id, item.size, { note: e.target.value })} className="w-full p-1.5 border border-stone-200 rounded-lg text-xs" placeholder="ملاحظات إضافية..." />
                    </div>
                    <button onClick={() => setIsItemEditOpen(null)} className="bg-avocado-btn text-white py-2 rounded-lg font-bold text-xs mt-auto">تأكيد</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        {/* Totals */}
          <div className="p-6 bg-stone-50 border-t border-stone-200 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-stone-500">
                <span>المجموع الفرعي</span>
                <span>{(subtotal || 0).toFixed(2)} {settings.currencySymbol}</span>
              </div>
              <div className="flex justify-between text-3xl font-black text-stone-900 pt-4 border-t border-stone-200">
                <span>{isReturnMode ? 'إجمالي المرتجع' : 'الإجمالي'}</span>
                <span className={isReturnMode ? 'text-red-600' : 'text-avocado-primary'}>{Math.abs(total || 0).toFixed(2)} {settings.currencySymbol}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (orderItems.length > 0) {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'تغيير الوضع',
                    message: 'سيتم مسح الطلب الحالي عند تغيير الوضع. هل أنت متأكد؟',
                    onConfirm: () => {
                      clearOrder();
                      setIsReturnMode(!isReturnMode);
                      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    },
                    type: 'warning'
                  });
                } else {
                  setIsReturnMode(!isReturnMode);
                }
              }}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border-2 ${
                isReturnMode 
                  ? 'bg-red-50 border-red-600 text-red-600 hover:bg-red-100' 
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <RotateCcw className={`w-5 h-5 ${isReturnMode ? 'animate-spin-slow' : ''}`} />
              {isReturnMode ? 'وضع البيع العادي' : 'وضع المرتجعات (Refund)'}
            </button>

            <button
              disabled={orderItems.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className={`w-full py-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-4 shadow-xl transition-all active:scale-95 ${
                isReturnMode 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-100 text-white' 
                  : 'bg-avocado-btn hover:bg-avocado-primary shadow-avocado-light text-white'
              }`}
            >
              <CreditCard className="w-8 h-8" />
              {isReturnMode ? 'تأكيد المرتجع' : 'دفع (F9)'}
            </button>
          </div>
        </aside>
      </div>
      ) : currentView === 'my-sales' ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          <header className="bg-white border-b border-stone-200 p-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-avocado-light text-avocado-primary rounded-2xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black">سجل المبيعات</h1>
                <p className="text-stone-500 text-sm">سجل العمليات في الجلسة الحالية</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
               <div className="text-right">
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">إجمالي المبيعات (Gross)</p>
                  <p className="text-lg font-black text-stone-900">
                    {invoices
                      .filter(inv => {
                        const matchesSearch = inv.orderNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase());
                        const matchesDate = (timeframeFilter === 'all' && !invoiceDateFilter)
                          ? true
                          : (activeSession && !invoiceDateFilter)
                            ? inv.sessionId === activeSession.id
                            : isInvoiceInTimeframe(inv.date, invoiceDateFilter, timeframeFilter);
                        const matchesPayment = !invoicePaymentFilter || inv.paymentMethod === invoicePaymentFilter;
                        return matchesSearch && matchesDate && matchesPayment && inv.status !== 'Cancelled' && inv.status !== 'Held';
                      })
                      .reduce((sum, inv) => {
                        let invGross = 0;
                        inv.items.forEach(item => {
                          if (item.quantity > 0) {
                            invGross += (item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0);
                          }
                        });
                        if (inv.discount > 0 && invGross > 0) invGross -= inv.discount;
                        return sum + invGross;
                      }, 0).toFixed(2)} {settings.currencySymbol}
                  </p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">المرتجعات</p>
                  <p className="text-lg font-black text-red-600">
                    {invoices
                      .filter(inv => {
                        const matchesSearch = inv.orderNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase());
                        const matchesDate = (timeframeFilter === 'all' && !invoiceDateFilter)
                          ? true
                          : (activeSession && !invoiceDateFilter)
                            ? inv.sessionId === activeSession.id
                            : isInvoiceInTimeframe(inv.date, invoiceDateFilter, timeframeFilter);
                        const matchesPayment = !invoicePaymentFilter || inv.paymentMethod === invoicePaymentFilter;
                        return matchesSearch && matchesDate && matchesPayment && inv.status !== 'Cancelled' && inv.status !== 'Held';
                      })
                      .reduce((sum, inv) => {
                        let invReturns = 0;
                        inv.items.forEach(item => {
                          if (item.quantity < 0) {
                            invReturns += Math.abs((item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0));
                          }
                        });
                        
                        let invGross = inv.items.reduce((s, item) => item.quantity > 0 ? s + (item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0) : s, 0);
                        if (inv.discount > 0 && invGross <= 0) invReturns += inv.discount;

                        const refundAmount = (inv.refundedItems || []).reduce((s, ri) => {
                          const item = inv.items.find(it => it.id === ri.productId);
                          const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
                          return s + (itemPrice * ri.quantity);
                        }, 0);
                        return sum + invReturns + refundAmount;
                      }, 0).toFixed(2)} {settings.currencySymbol}
                  </p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">صافي المبيعات (Net)</p>
                  <p className="text-xl font-black text-avocado-primary">
                    {invoices
                      .filter(inv => {
                        const matchesSearch = inv.orderNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase());
                        const matchesDate = (timeframeFilter === 'all' && !invoiceDateFilter)
                          ? true
                          : (activeSession && !invoiceDateFilter)
                            ? inv.sessionId === activeSession.id
                            : isInvoiceInTimeframe(inv.date, invoiceDateFilter, timeframeFilter);
                        const matchesPayment = !invoicePaymentFilter || inv.paymentMethod === invoicePaymentFilter;
                        return matchesSearch && matchesDate && matchesPayment && inv.status !== 'Cancelled' && inv.status !== 'Held';
                      })
                      .reduce((sum, inv) => {
                        let invGross = 0;
                        let invReturns = 0;
                        inv.items.forEach(item => {
                          const itemTotal = (item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0);
                          if (item.quantity > 0) invGross += itemTotal;
                          else invReturns += Math.abs(itemTotal);
                        });
                        if (inv.discount > 0) {
                          if (invGross > 0) invGross -= inv.discount;
                          else invReturns += inv.discount;
                        }
                        const refundAmount = (inv.refundedItems || []).reduce((s, ri) => {
                          const item = inv.items.find(it => it.id === ri.productId);
                          const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
                          return s + (itemPrice * ri.quantity);
                        }, 0);
                        return sum + (invGross - (invReturns + refundAmount));
                      }, 0).toFixed(2)} {settings.currencySymbol}
                  </p>
               </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8 bg-stone-50/50">
            <div className="space-y-6" ref={mySalesRef}>
              {/* Timeframe Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'daily', label: 'اليومي' },
                  { id: 'weekly', label: 'الأسبوعي' },
                  { id: 'monthly', label: 'الشهري' },
                  { id: 'yearly', label: 'السنوي' }
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => {
                      setTimeframeFilter(tf.id as any);
                      if (tf.id === 'all') setInvoiceDateFilter('');
                    }}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      timeframeFilter === tf.id 
                        ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-light' 
                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="بحث برقم الفاتورة..." 
                    className="w-full pr-10 pl-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  />
                </div>
                {currentUser?.role !== 'Cashier' && (
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={invoiceDateFilter}
                    onChange={(e) => setInvoiceDateFilter(e.target.value)}
                  />
                )}
                <select 
                  className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                  value={invoicePaymentFilter}
                  onChange={(e) => setInvoicePaymentFilter(e.target.value)}
                >
                  <option value="">كل طرق الدفع</option>
                  <option value="Cash">نقداً</option>
                  <option value="Card">بطاقة</option>
                  <option value="Wallet">محفظة</option>
                  <option value="Split">دفع مجزأ</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 print-hidden">
                <button 
                  onClick={() => {
                    const data = invoices
                      .filter(inv => {
                        const matchesSearch = inv.orderNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase());
                        const matchesDate = (timeframeFilter === 'all' && !invoiceDateFilter)
                          ? true
                          : (activeSession && !invoiceDateFilter)
                            ? inv.sessionId === activeSession.id
                            : isInvoiceInTimeframe(inv.date, invoiceDateFilter, timeframeFilter);
                        const matchesPayment = !invoicePaymentFilter || inv.paymentMethod === invoicePaymentFilter;
                        return matchesSearch && matchesDate && matchesPayment && inv.status !== 'Held';
                      })
                      .map(inv => ({
                        'رقم الفاتورة': inv.orderNumber,
                        'التاريخ والوقت': new Date(inv.date).toLocaleString('ar-EG'),
                        'طريقة الدفع': inv.paymentMethod,
                        'الإجمالي': (inv.total || 0).toFixed(2),
                        'الحالة': inv.status === 'Paid' ? 'مدفوع' : inv.status === 'Refunded' ? 'مسترجع' : 'معلق'
                      }));
                    
                    if (data.length === 0) return;
                    const headers = Object.keys(data[0]).join(',');
                    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
                    const csv = `${headers}\n${rows}`;
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `invoices_report_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                  }} 
                  className="flex items-center gap-2 px-4 py-2 bg-avocado-light text-avocado-primary rounded-full hover:bg-avocado-primary/20 font-bold transition-all"
                >
                  <Download className="w-4 h-4" />
                  تصدير Excel
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
                <table className="w-full text-right">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="p-4 font-bold text-stone-500 text-sm">رقم الفاتورة</th>
                      <th className="p-4 font-bold text-stone-500 text-sm">التاريخ والوقت</th>
                      <th className="p-4 font-bold text-stone-500 text-sm">طريقة الدفع</th>
                      <th className="p-4 font-bold text-stone-500 text-sm">الإجمالي</th>
                      <th className="p-4 font-bold text-stone-500 text-sm">الحالة</th>
                      <th className="p-4 font-bold text-stone-500 text-sm">العمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {invoices
                      .filter(inv => {
                        const matchesSearch = inv.orderNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase());
                        const matchesDate = (timeframeFilter === 'all' && !invoiceDateFilter)
                          ? true
                          : (activeSession && !invoiceDateFilter)
                            ? inv.sessionId === activeSession.id
                            : isInvoiceInTimeframe(inv.date, invoiceDateFilter, timeframeFilter);
                        const matchesPayment = !invoicePaymentFilter || inv.paymentMethod === invoicePaymentFilter;
                        return matchesSearch && matchesDate && matchesPayment && inv.status !== 'Held';
                      })
                      .map(inv => (
                      <tr key={inv.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="p-4 font-bold text-stone-700">{inv.orderNumber}</td>
                        <td className="p-4 text-stone-500 text-sm">
                          {(() => {
                            try {
                              return inv.date ? (
                                <>
                                  {new Date(inv.date).toLocaleDateString('ar-EG')} {new Date(inv.date).toLocaleTimeString('ar-EG')}
                                </>
                              ) : 'بدون تاريخ';
                            } catch (e) {
                              return 'تاريخ غير صالح';
                            }
                          })()}
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-1 bg-stone-100 rounded-full text-xs font-bold text-stone-600">
                            {inv.paymentMethod === 'Cash' ? 'نقداً' : inv.paymentMethod === 'Card' ? 'بطاقة' : inv.paymentMethod === 'Wallet' ? 'محفظة' : 'مجزأ'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-avocado-primary">{(inv.total || 0).toFixed(2)} {settings.currencySymbol}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                            inv.status === 'Paid' ? 'bg-avocado-light text-avocado-secondary' : 
                            inv.status === 'Refunded' ? 'bg-red-100 text-red-700' : 
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.status === 'Paid' ? 'تم الدفع' : inv.status === 'Refunded' ? 'مرتجع' : 'معلق'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setSelectedInvoice(inv)}
                              className="p-2 text-stone-400 hover:text-avocado-primary hover:bg-avocado-light rounded-lg transition-all"
                              title="عرض التفاصيل"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => {
                                triggerReceiptPrint(inv, false, settings);
                              }}
                              className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="إعادة طباعة"
                            >
                              <Printer className="w-5 h-5" />
                            </button>
                            {inv.status === 'Paid' && (
                              <button 
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setIsRefundModalOpen(true);
                                }}
                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="إرجاع"
                              >
                                <RotateCcw className="w-5 h-5" />
                              </button>
                            )}
                            {currentUser?.role === 'Admin' && (
                              <button 
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="حذف الفاتورة نهائياً"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      ) : currentView === 'expenses' ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white overflow-y-auto no-scrollbar">
          <Expenses 
            expenses={expenses}
            setExpenses={setExpenses}
            currentUser={currentUser} 
            users={users} 
            settings={settings} 
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          <header className="bg-white border-b border-stone-200 p-4 md:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2 md:p-3 bg-avocado-light text-avocado-primary rounded-xl md:rounded-2xl">
                <Settings className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black">{currentUser?.role === 'Admin' ? 'لوحة الإدارة' : 'لوحة المشرف'}</h1>
                <p className="text-stone-500 text-xs md:text-sm">
                  {currentUser?.role === 'Admin' ? 'إدارة النظام والمنتجات والمخزون' : 'متابعة المبيعات والمخزون والمنتجات'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto no-scrollbar">
              <div className="flex gap-2 shrink-0">
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') ? (
                  <button 
                    onClick={() => setAdminSubView('dashboard')}
                    className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'dashboard' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    لوحة التحكم والتقارير
                  </button>
                ) : (
                  <button 
                    onClick={() => setAdminSubView('dashboard')}
                    className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'dashboard' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    كاش اليوم
                  </button>
                )}
                <button 
                  onClick={() => setAdminSubView('products')}
                  className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'products' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  المنتجات
                </button>
                <button 
                  onClick={() => setAdminSubView('categories')}
                  className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'categories' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  التصنيفات
                </button>
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
                  <>
                    <button 
                      onClick={() => setAdminSubView('invoices')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'invoices' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      الفواتير
                    </button>
                    <button 
                      onClick={() => setAdminSubView('purchases')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'purchases' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      المشتريات
                    </button>
                    <button 
                      onClick={() => setAdminSubView('inventory-log')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'inventory-log' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      سجل المخزون
                    </button>
                    <button 
                      onClick={() => setAdminSubView('suppliers')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'suppliers' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      الموردين
                    </button>
                    <button 
                      onClick={() => setAdminSubView('expenses')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'expenses' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      المصروفات
                    </button>
                    <button 
                      onClick={() => setAdminSubView('returns')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'returns' ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      المرتجعات
                    </button>
                  </>
                )}
                {currentUser?.role === 'Admin' && (
                  <>
                    <button 
                      onClick={() => setAdminSubView('users')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'users' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      المستخدمين
                    </button>
                    <button 
                      onClick={() => setAdminSubView('register-sessions')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'register-sessions' ? 'bg-avocado-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      جلسات الكاشير
                    </button>
                    <button 
                      onClick={() => setAdminSubView('settings')}
                      className={`px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-all whitespace-nowrap ${adminSubView === 'settings' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      الإعدادات
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8 bg-stone-50/50">
            {adminSubView === 'products' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Package className="w-6 h-6 text-stone-400" />
                    قائمة المنتجات ({products.length})
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingProduct({ id: Date.now().toString(), name: '', price: 0, purchasePrice: 0, image: '', barcode: '', category: '', stock: 0, minStock: 0, status: 'available', itemType: 'sellable' } as Product);
                        setProductHasSizes(false);
                        setImagePreview(null);
                        setIsProductModalOpen(true);
                      }}
                      className="bg-avocado-btn text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light"
                    >
                      <Plus className="w-5 h-5" /> إضافة منتج جديد
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 overflow-x-auto shadow-sm no-scrollbar">
                  <table className="w-full text-right min-w-[1000px]">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="p-4 font-bold text-stone-500 text-sm">المنتج</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">التصنيف</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">النوع</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">سعر الشراء</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">سعر البيع</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">المخزون</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الحالة</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {products.map(product => (
                        <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img src={product.image} className="w-12 h-12 rounded-xl object-cover border border-stone-100" referrerPolicy="no-referrer" />
                              <div>
                                <div className="font-bold">{product.name}</div>
                                <div className="text-[10px] text-stone-400 font-mono">{product.barcode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4"><span className="px-3 py-1 bg-stone-100 rounded-full text-xs font-bold text-stone-600">{product.category}</span></td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${product.itemType === 'internal' ? 'bg-amber-100 text-amber-700' : 'bg-avocado-100 text-avocado-700'}`}>
                              {product.itemType === 'internal' ? 'مخزون داخلي' : 'قابل للبيع'}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-stone-600">{(product.purchasePrice || 0).toFixed(2)} {settings.currencySymbol}</td>
                          <td className="p-4 font-bold text-avocado-primary">{(product.price || 0).toFixed(2)} {settings.currencySymbol}</td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className={`font-bold ${product.stock <= product.minStock ? 'text-amber-600' : 'text-stone-700'}`}>{product.stock}</span>
                              <span className="text-[10px] text-stone-400">الحد الأدنى: {product.minStock}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${product.status === 'available' ? 'bg-avocado-light text-avocado-secondary' : 'bg-red-100 text-red-700'}`}>
                              {product.status === 'available' ? 'متوفر' : 'غير متوفر'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager') && (
                                <>
                                  <button 
                                    onClick={() => {
                                      const p = { ...product };
                                      if (p.hasSizes && !p.prices) {
                                        p.prices = { S: 0, M: 0, L: 0 };
                                      }
                                      setEditingProduct(p);
                                      setProductHasSizes(!!p.hasSizes);
                                      setImagePreview(p.image);
                                      setIsProductModalOpen(true);
                                    }}
                                    className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  >
                                    <Edit3 className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'حذف منتج',
                                        message: `هل أنت متأكد من حذف ${product.name}؟ لا يمكن التراجع عن هذا الإجراء.`,
                                        type: 'danger',
                                        onConfirm: async () => {
                                          try {
                                            await deleteDoc(doc(db, 'products', product.id));
                                            setShowToast('تم حذف المنتج بنجاح');
                                            setTimeout(() => setShowToast(null), 3000);
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`);
                                          }
                                        }
                                      });
                                    }}
                                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminSubView === 'categories' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Layers className="w-6 h-6 text-stone-400" />
                    التصنيفات ({categories.length})
                  </h2>
                  <button 
                    onClick={() => {
                      setEditingCategory({ id: Date.now().toString(), name: '', icon: '📦' });
                      setIsCategoryModalOpen(true);
                    }}
                    className="bg-avocado-btn text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light"
                  >
                    <Plus className="w-5 h-5" /> إضافة تصنيف جديد
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categories.map(cat => (
                    <div key={cat.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center text-2xl border border-stone-100">
                          {cat.icon}
                        </div>
                        <div>
                          <h3 className="font-black text-lg">{cat.name}</h3>
                          <p className="text-stone-400 text-xs">{products.filter(p => p.category === cat.name).length} منتج</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setIsCategoryModalOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'حذف تصنيف',
                              message: `هل أنت متأكد من حذف تصنيف ${cat.name}؟ سيتم إلغاء ربط المنتجات بهذا التصنيف.`,
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  // Unlink products in Firestore
                                  const productsToUnlink = products.filter(p => p.category === cat.name);
                                  for (const p of productsToUnlink) {
                                    await updateDoc(doc(db, 'products', p.id), { category: '' });
                                  }
                                  
                                  await deleteDoc(doc(db, 'categories', cat.id));
                                  setShowToast('تم حذف التصنيف بنجاح');
                                  setTimeout(() => setShowToast(null), 3000);
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, `categories/${cat.id}`);
                                }
                              }
                            });
                          }}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminSubView === 'invoices' && (
              <div className="space-y-6" ref={adminInvoicesRef}>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <FileText className="w-6 h-6 text-stone-400" />
                    سجل الفواتير ({filteredInvoices.length})
                  </h2>
                  <button 
                    onClick={fixMalformedInvoices}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 font-bold transition-all border border-amber-200"
                  >
                    <RefreshCw className="w-4 h-4" />
                    إصلاح الفواتير العالقة
                  </button>
                </div>

                {/* Timeframe Filter Buttons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'daily', label: 'اليومي' },
                    { id: 'weekly', label: 'الأسبوعي' },
                    { id: 'monthly', label: 'الشهري' },
                    { id: 'yearly', label: 'السنوي' }
                  ].map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => {
                        setTimeframeFilter(tf.id as any);
                        if (tf.id === 'all') setInvoiceDateFilter('');
                      }}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                        timeframeFilter === tf.id 
                          ? 'bg-avocado-primary text-white shadow-lg shadow-avocado-light' 
                          : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="بحث برقم الفاتورة أو العميل..." 
                      className="w-full pr-10 pl-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                      value={invoiceSearchQuery}
                      onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    />
                  </div>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={invoiceDateFilter}
                    onChange={(e) => setInvoiceDateFilter(e.target.value)}
                  />
                  <select 
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={invoicePaymentFilter}
                    onChange={(e) => setInvoicePaymentFilter(e.target.value)}
                  >
                    <option value="">كل طرق الدفع</option>
                    <option value="Cash">نقداً</option>
                    <option value="Card">بطاقة</option>
                    <option value="Wallet">محفظة</option>
                    <option value="Split">دفع مجزأ</option>
                  </select>
                  <select 
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={invoiceCashierFilter}
                    onChange={(e) => setInvoiceCashierFilter(e.target.value)}
                  >
                    <option value="">كل الكاشيرية</option>
                    {users
                      .filter(u => u.email !== 'mohammadalmasri950@gmail.com')
                      .map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 print-hidden">
                  <button 
                    onClick={() => {
                      const data = filteredInvoices.map(inv => ({
                        'رقم الفاتورة': inv.orderNumber,
                        'التاريخ والوقت': new Date(inv.date).toLocaleString('ar-EG'),
                        'العميل': inv.customerName || 'عميل نقدي',
                        'الكاشير': inv.cashierName,
                        'طريقة الدفع': inv.paymentMethod,
                        'الإجمالي': (inv.total || 0).toFixed(2),
                        'الحالة': inv.status === 'Paid' ? 'مدفوع' : inv.status === 'Refunded' ? 'مسترجع' : inv.status === 'Cancelled' ? 'ملغي' : 'معلق'
                      }));
                      
                      if (data.length === 0) return;
                      const headers = Object.keys(data[0]).join(',');
                      const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
                      const csv = `${headers}\n${rows}`;
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `admin_invoices_report_${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                    }} 
                    className="flex items-center gap-2 px-4 py-2 bg-avocado-light text-avocado-primary rounded-full hover:bg-avocado-primary/20 font-bold transition-all"
                  >
                    <Download className="w-4 h-4" />
                    تصدير Excel
                  </button>
                </div>

                {/* Invoices Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-avocado-light p-4 rounded-2xl border border-avocado-primary/10">
                    <div className="text-[10px] text-avocado-primary font-bold uppercase mb-1">إجمالي الفواتير المفلترة (Gross)</div>
                    <div className="text-xl font-black text-avocado-primary">
                      {filteredInvoices.filter(inv => inv.status !== 'Cancelled').reduce((acc, inv) => {
                        let invGross = 0;
                        inv.items.forEach(item => {
                          if (item.quantity > 0) {
                            invGross += (item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0);
                          }
                        });
                        if (inv.discount > 0 && invGross > 0) invGross -= inv.discount;
                        return acc + invGross;
                      }, 0).toFixed(2)} {settings.currencySymbol}
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <div className="text-[10px] text-red-600 font-bold uppercase mb-1">إجمالي المرتجعات المفلترة</div>
                    <div className="text-xl font-black text-red-700">
                      {filteredInvoices.filter(inv => inv.status !== 'Cancelled').reduce((acc, inv) => {
                        let invReturns = 0;
                        inv.items.forEach(item => {
                          if (item.quantity < 0) {
                            invReturns += Math.abs((item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0));
                          }
                        });
                        
                        let invGross = inv.items.reduce((s, item) => item.quantity > 0 ? s + (item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0) : s, 0);
                        if (inv.discount > 0 && invGross <= 0) invReturns += inv.discount;

                        const refundAmount = (inv.refundedItems || []).reduce((sum, ri) => {
                          const item = inv.items.find(i => i.id === ri.productId);
                          const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
                          return sum + (itemPrice * ri.quantity);
                        }, 0);
                        return acc + invReturns + refundAmount;
                      }, 0).toFixed(2)} {settings.currencySymbol}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="text-[10px] text-blue-600 font-bold uppercase mb-1">صافي المبيعات المفلترة (Net)</div>
                    <div className="text-xl font-black text-blue-700">
                      {filteredInvoices.filter(inv => inv.status !== 'Cancelled').reduce((acc, inv) => {
                        let invGross = 0;
                        let invReturns = 0;
                        inv.items.forEach(item => {
                          const itemTotal = (item.manualPrice !== undefined ? item.manualPrice : item.price) * item.quantity - (item.discount || 0);
                          if (item.quantity > 0) invGross += itemTotal;
                          else invReturns += Math.abs(itemTotal);
                        });
                        if (inv.discount > 0) {
                          if (invGross > 0) invGross -= inv.discount;
                          else invReturns += inv.discount;
                        }
                        const refundAmount = (inv.refundedItems || []).reduce((sum, ri) => {
                          const item = inv.items.find(i => i.id === ri.productId);
                          const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
                          return sum + (itemPrice * ri.quantity);
                        }, 0);
                        return acc + (invGross - (invReturns + refundAmount));
                      }, 0).toFixed(2)} {settings.currencySymbol}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 overflow-x-auto shadow-sm no-scrollbar">
                  <table className="w-full text-right min-w-[1000px]">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="p-4 font-bold text-stone-500 text-sm">رقم الفاتورة</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">التاريخ والوقت</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">العميل</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الكاشير</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">طريقة الدفع</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الإجمالي</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الحالة</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4 font-bold text-stone-700">{inv.orderNumber}</td>
                          <td className="p-4 text-stone-500 text-sm">
                            {(() => {
                              try {
                                return inv.date ? (
                                  <>
                                    {new Date(inv.date).toLocaleDateString('ar-EG')} {new Date(inv.date).toLocaleTimeString('ar-EG')}
                                  </>
                                ) : 'بدون تاريخ';
                              } catch (e) {
                                return 'تاريخ غير صالح';
                              }
                            })()}
                          </td>
                          <td className="p-4 text-stone-600">{inv.customerName || 'عميل نقدي'}</td>
                          <td className="p-4 text-stone-600">{inv.cashierName}</td>
                          <td className="p-4">
                            <span className="px-3 py-1 bg-stone-100 rounded-full text-xs font-bold text-stone-600">
                              {inv.paymentMethod === 'Cash' ? 'نقداً' : inv.paymentMethod === 'Card' ? 'بطاقة' : inv.paymentMethod === 'Wallet' ? 'محفظة' : 'مجزأ'}
                            </span>
                          </td>
                          <td className="p-4 font-black text-avocado-primary">{(inv.total || 0).toFixed(2)} {settings.currencySymbol}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                              inv.status === 'Paid' ? 'bg-avocado-light text-avocado-secondary' : 
                              inv.status === 'Refunded' ? 'bg-red-100 text-red-700' : 
                              inv.status === 'Cancelled' ? 'bg-stone-100 text-stone-700' : 
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {inv.status === 'Paid' ? 'تم الدفع' : inv.status === 'Refunded' ? 'مرتجع' : inv.status === 'Cancelled' ? 'ملغي' : 'معلق'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setSelectedInvoice(inv)}
                                className="p-2 text-stone-400 hover:text-avocado-primary hover:bg-avocado-light rounded-lg transition-all"
                                title="عرض التفاصيل"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => {
                                  triggerReceiptPrint(inv, false, settings);
                                }}
                                className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="إعادة طباعة"
                              >
                                <Printer className="w-5 h-5" />
                              </button>
                              {inv.status === 'Paid' && (
                                <button 
                                  onClick={() => {
                                    setSelectedInvoice(inv);
                                    setIsRefundModalOpen(true);
                                  }}
                                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="إرجاع الفاتورة"
                                >
                                  <RotateCcw className="w-5 h-5" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="حذف الفاتورة نهائياً"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminSubView === 'returns' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <RotateCcw className="w-6 h-6 text-red-400" />
                    سجل المرتجعات
                  </h2>
                  <button 
                    onClick={() => setAdminSubView('invoices')}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> إرجاع فاتورة جديدة
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
                  <table className="w-full text-right">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="p-4 font-bold text-stone-500 text-sm">التاريخ</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">رقم الفاتورة</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">المنتج</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الكمية</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">السبب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {invoices.flatMap(inv => {
                        const returns: any[] = [];
                        // Add explicit refunds
                        (inv.refundedItems || []).forEach((ri, idx) => {
                          returns.push(
                            <tr key={`refund-${inv.id}-${idx}`} className="hover:bg-stone-50/50 transition-colors">
                              <td className="p-4 text-stone-500 text-sm">{new Date(ri.date).toLocaleString('ar-EG')}</td>
                              <td className="p-4 font-bold text-stone-700">{inv.orderNumber}</td>
                              <td className="p-4 font-bold text-stone-900">
                                {inv.items.find(it => it.id === ri.productId)?.name || 'منتج غير معروف'}
                              </td>
                              <td className="p-4 text-red-600 font-bold">{ri.quantity}</td>
                              <td className="p-4 text-stone-500 italic">{ri.reason || 'إرجاع من إدارة الفواتير'}</td>
                            </tr>
                          );
                        });
                        // Add POS returns (negative quantities)
                        inv.items.forEach((item, idx) => {
                          if (item.quantity < 0) {
                            returns.push(
                              <tr key={`pos-return-${inv.id}-${idx}`} className="hover:bg-stone-50/50 transition-colors">
                                <td className="p-4 text-stone-500 text-sm">{new Date(inv.date).toLocaleString('ar-EG')}</td>
                                <td className="p-4 font-bold text-stone-700">{inv.orderNumber}</td>
                                <td className="p-4 font-bold text-stone-900">{item.name}</td>
                                <td className="p-4 text-red-600 font-bold">{Math.abs(item.quantity)}</td>
                                <td className="p-4 text-stone-500 italic">إرجاع مباشر من نقطة البيع</td>
                              </tr>
                            );
                          }
                        });
                        return returns;
                      })}
                      {invoices.every(inv => (!inv.refundedItems || inv.refundedItems.length === 0) && !inv.items.some(it => it.quantity < 0)) && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-stone-400">لا توجد مرتجعات مسجلة</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            {adminSubView === 'users' && currentUser?.role === 'Admin' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <User className="w-6 h-6 text-stone-400" />
                    إدارة المستخدمين ({users.length})
                  </h2>
                  <button 
                    onClick={() => {
                      setEditingUser(null);
                      setIsUserModalOpen(true);
                    }}
                    className="bg-avocado-btn text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light"
                  >
                    <Plus className="w-5 h-5" /> إضافة مستخدم جديد
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 overflow-x-auto shadow-sm no-scrollbar">
                  <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="p-4 font-bold text-stone-500 text-sm">الاسم</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">البريد الإلكتروني</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الدور</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">تاريخ الإضافة</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {users.filter(u => u.email !== 'mohammadalmasri950@gmail.com').map(user => (
                        <tr key={user.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4 font-bold text-stone-700">{user.name}</td>
                          <td className="p-4 text-stone-600">{user.email}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                              user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 
                              user.role === 'Manager' ? 'bg-blue-100 text-blue-700' : 
                              'bg-stone-100 text-stone-700'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 text-stone-400 text-sm">
                            {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setEditingUser(user);
                                  setIsUserModalOpen(true);
                                }}
                                className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <Edit3 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'حذف مستخدم',
                                    message: `هل أنت متأكد من حذف ${user.name}؟`,
                                    type: 'danger',
                                    onConfirm: () => deleteUser(user.id)
                                  });
                                }}
                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminSubView === 'dashboard' && (
              (currentUser?.role === 'Admin' || currentUser?.role === 'Manager') ? (
                <Reports invoices={invoices} products={products} users={users} categories={categories} purchases={purchases} expenses={expenses} settings={settings} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-6 pt-12">
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm text-center max-w-md w-full">
                    <div className="w-20 h-20 bg-avocado-light text-avocado-primary rounded-full flex items-center justify-center mx-auto mb-6">
                      <DollarSign className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-stone-800 mb-2">كاش الجلسة الحالية</h2>
                    <p className="text-stone-500 mb-6">إجمالي المبالغ النقدية في الجلسة المفتوحة حالياً</p>
                    <div className="text-5xl font-black text-avocado-primary">
                      {activeSession ? (
                        invoices
                          .filter(inv => inv.sessionId === activeSession.id && inv.status !== 'Cancelled' && inv.status !== 'Held')
                          .reduce((sum, inv) => {
                            // Calculate total cash payments
                            const cashPayments = inv.payments?.filter(p => p.method === 'Cash' || p.method === 'cash').reduce((s, p) => s + p.amount, 0) || 0;
                            // If it's a legacy invoice without payments array but has cashPaid
                            const legacyCash = (!inv.payments && (inv.paymentMethod === 'Cash' || inv.paymentMethod === 'cash')) ? inv.total : 0;
                            return sum + cashPayments + legacyCash;
                          }, 0)
                          .toFixed(2)
                      ) : (
                        "0.00"
                      )} {settings.currencySymbol}
                    </div>
                  </div>
                </div>
              )
            )}

            {adminSubView === 'suppliers' && (
              <Suppliers 
                suppliers={suppliers}
                setSuppliers={setSuppliers}
                transactions={supplierTransactions}
                setTransactions={setSupplierTransactions}
                currentUser={currentUser}
              />
            )}

            {adminSubView === 'purchases' && (
              <Purchases 
                products={products} 
                setProducts={setProducts}
                setInventoryMovements={setInventoryMovements}
                currentUser={currentUser} 
                settings={settings} 
              />
            )}

            {adminSubView === 'inventory-log' && (
              <InventoryLog products={products} inventoryMovements={inventoryMovements} />
            )}

            {adminSubView === 'expenses' && (
              <Expenses 
                expenses={expenses}
                setExpenses={setExpenses}
                currentUser={currentUser} 
                users={users} 
                settings={settings} 
              />
            )}

            {adminSubView === 'register-sessions' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-stone-400" />
                    سجل جلسات الكاشير ({registerHistory.length})
                  </h2>
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
                  <table className="w-full text-right">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr>
                        <th className="p-4 font-bold text-stone-500 text-sm">الكاشير</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">وقت الفتح</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">وقت الإغلاق</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الرصيد الافتتاحي</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الرصيد المتوقع</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الرصيد الفعلي</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الفرق</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">الحالة</th>
                        <th className="p-4 font-bold text-stone-500 text-sm">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {registerHistory.map(session => (
                        <tr key={session.id} className="hover:bg-stone-50/50 transition-colors text-sm">
                          <td className="p-4 font-bold">{session.userName}</td>
                          <td className="p-4">{new Date(session.openingTime).toLocaleString('ar-EG')}</td>
                          <td className="p-4">{session.closingTime ? new Date(session.closingTime).toLocaleString('ar-EG') : '-'}</td>
                          <td className="p-4 font-bold">{(session.openingCash || 0).toFixed(2)} {settings.currencySymbol}</td>
                          <td className="p-4">{session.expectedCash != null ? session.expectedCash.toFixed(2) : '-'} {settings.currencySymbol}</td>
                          <td className="p-4">{session.closingCash != null ? session.closingCash.toFixed(2) : '-'} {settings.currencySymbol}</td>
                          <td className={`p-4 font-bold ${session.difference && session.difference < 0 ? 'text-red-600' : session.difference && session.difference > 0 ? 'text-green-600' : 'text-stone-600'}`}>
                            {session.difference != null ? `${session.difference > 0 ? '+' : ''}${session.difference.toFixed(2)}` : '-'} {settings.currencySymbol}
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${session.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                              {session.status === 'Open' ? 'مفتوح' : 'مغلق'}
                            </span>
                          </td>
                          <td className="p-4">
                            <button 
                              onClick={() => handleViewSession(session)}
                              className="p-2 text-stone-400 hover:text-avocado-primary hover:bg-avocado-light rounded-lg transition-all"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminSubView === 'settings' && (
              <SettingsComponent 
                settings={settings} 
                onUpdateSettings={updateSettings} 
                users={users} 
                currentUser={currentUser} 
                onResetFinancial={handleResetFinancial}
                products={products}
                categories={categories}
              />
            )}
          </main>
        </div>
      )}

      {/* Product Management Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
              <form onSubmit={saveProduct} className="p-5 md:p-8 flex flex-col h-full overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-black">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
                  <button type="button" onClick={() => { setIsProductModalOpen(false); setImagePreview(null); }} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-stone-500 mb-2">اسم المنتج</label>
                    <input 
                      name="name" 
                      value={editingProduct?.name || ''} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, name: e.target.value } : { name: e.target.value } as Product)}
                      required 
                      className="w-full p-3 md:p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                      placeholder="مثال: إسبريسو دبل" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">الباركود</label>
                    <input 
                      name="barcode" 
                      value={editingProduct?.barcode || ''} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, barcode: e.target.value } : { barcode: e.target.value } as Product)}
                      required 
                      className="w-full p-3 md:p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                      placeholder="1001" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">التصنيف</label>
                    <select 
                      name="category" 
                      value={editingProduct?.category || ''} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, category: e.target.value } : { category: e.target.value } as Product)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none appearance-none"
                    >
                      <option value="" disabled>اختر التصنيف...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">نوع الصنف</label>
                    <select 
                      name="itemType" 
                      value={editingProduct?.itemType || 'sellable'} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, itemType: e.target.value as 'sellable' | 'internal' } : { itemType: e.target.value as 'sellable' | 'internal' } as Product)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none appearance-none"
                    >
                      <option value="sellable">صنف يباع في الكاشير</option>
                      <option value="internal">عنصر مخزون داخلي (لا يباع)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">سعر الشراء ({settings.currencySymbol})</label>
                    <input 
                      name="purchasePrice" 
                      type="number" 
                      step="0.01" 
                      value={editingProduct?.purchasePrice ?? ''} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, purchasePrice: parseFloat(e.target.value) || 0 } : { purchasePrice: parseFloat(e.target.value) || 0 } as Product)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                      placeholder="0.00" 
                    />
                  </div>

                  <div className="md:col-span-2 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative inline-flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={productHasSizes}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setProductHasSizes(checked);
                            if (checked && !editingProduct?.prices) {
                              setEditingProduct(prev => prev ? { 
                                ...prev, 
                                hasSizes: true,
                                prices: { S: 0, M: 0, L: 0 } 
                              } : { 
                                hasSizes: true,
                                prices: { S: 0, M: 0, L: 0 } 
                              } as Product);
                            }
                          }}
                        />
                        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-avocado-light rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-avocado-primary"></div>
                      </div>
                      <span className="font-bold text-stone-700">هذا المنتج له أحجام (S, M, L)</span>
                    </label>
                  </div>

                  {!productHasSizes ? (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-stone-500 mb-2">سعر البيع ({settings.currencySymbol})</label>
                      <input 
                        name="price" 
                        type="number" 
                        step="0.01" 
                        value={editingProduct?.price ?? ''} 
                        onChange={(e) => setEditingProduct(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : { price: parseFloat(e.target.value) || 0 } as Product)}
                        required={!productHasSizes} 
                        className="w-full p-3 md:p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                        placeholder="0.00" 
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-2 grid grid-cols-3 gap-3 md:gap-4 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="block text-[10px] md:text-xs font-bold text-stone-400 mb-1 text-center">سعر الحجم S ({settings.currencySymbol})</label>
                        <input 
                          name="price_S" 
                          type="number" 
                          step="0.01" 
                          value={editingProduct?.prices?.S ?? ''} 
                          onChange={(e) => setEditingProduct(prev => {
                            const current = prev || {} as Product;
                            return { ...current, prices: { ...(current.prices || { S: 0, M: 0, L: 0 }), S: parseFloat(e.target.value) || 0 } } as Product;
                          })}
                          required={productHasSizes} 
                          className="w-full p-3 md:p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none text-center font-bold text-sm md:text-base" 
                          placeholder="S" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] md:text-xs font-bold text-stone-400 mb-1 text-center">سعر الحجم M ({settings.currencySymbol})</label>
                        <input 
                          name="price_M" 
                          type="number" 
                          step="0.01" 
                          value={editingProduct?.prices?.M ?? ''} 
                          onChange={(e) => setEditingProduct(prev => {
                            const current = prev || {} as Product;
                            return { ...current, prices: { ...(current.prices || { S: 0, M: 0, L: 0 }), M: parseFloat(e.target.value) || 0 } } as Product;
                          })}
                          required={productHasSizes} 
                          className="w-full p-3 md:p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none text-center font-bold text-sm md:text-base" 
                          placeholder="M" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] md:text-xs font-bold text-stone-400 mb-1 text-center">سعر الحجم L ({settings.currencySymbol})</label>
                        <input 
                          name="price_L" 
                          type="number" 
                          step="0.01" 
                          value={editingProduct?.prices?.L ?? ''} 
                          onChange={(e) => setEditingProduct(prev => {
                            const current = prev || {} as Product;
                            return { ...current, prices: { ...(current.prices || { S: 0, M: 0, L: 0 }), L: parseFloat(e.target.value) || 0 } } as Product;
                          })}
                          required={productHasSizes} 
                          className="w-full p-3 md:p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none text-center font-bold text-sm md:text-base" 
                          placeholder="L" 
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">الكمية في المخزون</label>
                    <input 
                      name="stock" 
                      type="number" 
                      value={editingProduct?.stock ?? ''} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, stock: parseInt(e.target.value) || 0 } : { stock: parseInt(e.target.value) || 0 } as Product)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                      placeholder="0" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">حد التنبيه (Min Stock)</label>
                    <input 
                      name="minStock" 
                      type="number" 
                      value={editingProduct?.minStock ?? ''} 
                      onChange={(e) => setEditingProduct(prev => prev ? { ...prev, minStock: parseInt(e.target.value) || 0 } : { minStock: parseInt(e.target.value) || 0 } as Product)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                      placeholder="5" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-stone-500 mb-2">صورة المنتج</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex-1">
                        <div className="relative group">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="w-full p-8 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-2 bg-stone-50 group-hover:border-avocado-primary group-hover:bg-avocado-light transition-all">
                            <Upload className="w-8 h-8 text-stone-400 group-hover:text-avocado-primary" />
                            <span className="text-sm font-bold text-stone-500 group-hover:text-avocado-primary">اضغط لرفع صورة أو اسحبها هنا</span>
                            <span className="text-[10px] text-stone-400">الحد الأقصى: 2MB</span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-[10px] font-bold text-stone-400 mb-1">أو استخدم رابط صورة خارجي (URL)</label>
                          <input 
                            name="image" 
                            value={editingProduct?.image || ''} 
                            onChange={(e) => {
                              setImagePreview(e.target.value);
                              setEditingProduct(prev => prev ? { ...prev, image: e.target.value } : { image: e.target.value } as Product);
                            }}
                            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none text-sm" 
                            placeholder="https://..." 
                          />
                        </div>
                      </div>
                      
                      {(imagePreview || editingProduct?.image) && (
                        <div className="w-32 h-32 rounded-2xl border border-stone-200 overflow-hidden relative group">
                          <img 
                            src={imagePreview || editingProduct?.image} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            type="button"
                            onClick={() => setImagePreview(null)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-stone-500 mb-2">حالة المنتج</label>
                    <div className="flex gap-4">
                      <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl cursor-pointer has-[:checked]:bg-avocado-light has-[:checked]:border-avocado-primary transition-all">
                        <input 
                          type="radio" 
                          name="status" 
                          value="available" 
                          checked={editingProduct?.status !== 'unavailable'} 
                          onChange={() => setEditingProduct(prev => prev ? { ...prev, status: 'available' } : { status: 'available' } as Product)}
                          className="hidden" 
                        />
                        <Check className="w-5 h-5 text-avocado-primary opacity-0 [.peer:checked+&]:opacity-100" />
                        <span className="font-bold">متوفر</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl cursor-pointer has-[:checked]:bg-red-50 has-[:checked]:border-red-500 transition-all">
                        <input 
                          type="radio" 
                          name="status" 
                          value="unavailable" 
                          checked={editingProduct?.status === 'unavailable'} 
                          onChange={() => setEditingProduct(prev => prev ? { ...prev, status: 'unavailable' } : { status: 'unavailable' } as Product)}
                          className="hidden" 
                        />
                        <AlertTriangle className="w-5 h-5 text-red-600 opacity-0 [.peer:checked+&]:opacity-100" />
                        <span className="font-bold">غير متوفر</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`flex-1 bg-avocado-btn text-white py-4 rounded-2xl font-black text-lg hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : 'حفظ المنتج'}
                  </button>
                  <button type="button" onClick={() => { setIsProductModalOpen(false); setImagePreview(null); }} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-black text-lg hover:bg-stone-200 transition-all">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <form onSubmit={saveCategory} className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black">{editingCategory ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}</h2>
                  <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-6 h-6" /></button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">اسم التصنيف</label>
                    <input 
                      name="name" 
                      value={editingCategory?.name || ''} 
                      onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : { name: e.target.value } as Category)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none" 
                      placeholder="مثال: مشروبات ساخنة" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">أيقونة (Emoji)</label>
                    <input 
                      name="icon" 
                      value={editingCategory?.icon || ''} 
                      onChange={(e) => setEditingCategory(prev => prev ? { ...prev, icon: e.target.value } : { icon: e.target.value } as Category)}
                      required 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none text-center text-2xl" 
                      placeholder="☕" 
                    />
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`flex-1 bg-avocado-btn text-white py-4 rounded-2xl font-black text-lg hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : 'حفظ التصنيف'}
                  </button>
                  <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-black text-lg hover:bg-stone-200 transition-all">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm print:hidden">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[95vh] md:max-h-[700px] m-2 md:m-4">
              {/* Left Side - Payment Info */}
              <div className="flex-1 p-4 md:p-8 flex flex-col overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-4 md:mb-8">
                  <h2 className="text-2xl md:text-3xl font-black">إتمام الدفع</h2>
                  <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                  {[
                    { id: 'Cash', label: 'نقدي', icon: DollarSign, color: 'avocado' },
                    { id: 'Card', label: 'بطاقة', icon: CardIcon, color: 'blue' },
                    { id: 'Wallet', label: 'محفظة', icon: MessageSquare, color: 'orange' },
                    { id: 'Split', label: 'دفع مختلط', icon: Layers, color: 'purple' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                      className={`flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-2xl border-2 transition-all ${
                        paymentMethod === method.id 
                        ? `border-${method.color}-500 bg-${method.color}-50 text-${method.color}-700` 
                        : 'border-stone-100 bg-stone-50 text-stone-400 grayscale hover:grayscale-0'
                      }`}
                    >
                      <method.icon className="w-6 h-6 md:w-8 md:h-8" />
                      <span className="font-bold text-sm md:text-base">{method.label}</span>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'Cash' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-stone-500 font-bold">المبلغ المدفوع (نقدي)</label>
                        <button 
                          onClick={() => setCashAmount('')}
                          className="text-xs text-red-500 hover:underline font-bold"
                        >
                          مسح (Clear)
                        </button>
                      </div>
                      <div className="relative">
                        <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input 
                          type="number" 
                          autoFocus
                          className="w-full pr-12 pl-4 py-4 md:py-6 bg-stone-50 border-2 border-stone-200 rounded-2xl text-2xl md:text-4xl font-black focus:border-avocado-primary outline-none transition-all"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (cashAmount === '' || parseFloat(cashAmount) >= total)) {
                              handleCheckout(true);
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {[10, 20, 50, 100, 200].map(amount => (
                        <button 
                          key={amount} 
                          onClick={() => setCashAmount(prev => (parseFloat(prev || '0') + amount).toString())} 
                          className="flex-1 min-w-[60px] py-3 bg-stone-100 rounded-xl font-bold hover:bg-stone-200 transition-colors border border-stone-200"
                        >
                          +{amount}
                        </button>
                      ))}
                      <button 
                        onClick={() => setCashAmount(total.toString())} 
                        className="flex-1 min-w-[120px] py-3 bg-avocado-light text-avocado-secondary rounded-xl font-bold hover:bg-avocado-primary/20 transition-colors border border-avocado-primary/20"
                      >
                        المبلغ كاملاً
                      </button>
                    </div>
                  </div>
                )}

                {paymentMethod === 'Split' && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-purple-700 font-bold">إجمالي الفاتورة:</span>
                        <span className="text-2xl font-black text-purple-900">{(total || 0).toFixed(2)} {settings.currencySymbol}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 md:gap-4">
                      {[
                        { id: 'Cash', label: 'نقدي', icon: DollarSign },
                        { id: 'Card', label: 'بطاقة', icon: CardIcon },
                        { id: 'Wallet', label: 'محفظة', icon: MessageSquare }
                      ].map(method => (
                        <div key={method.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 bg-stone-50 p-3 md:p-4 rounded-2xl border border-stone-200">
                          <div className="flex items-center gap-3 w-full sm:w-32">
                            <method.icon className="w-4 h-4 md:w-5 md:h-5 text-stone-400" />
                            <span className="font-bold text-sm md:text-base">{method.label}</span>
                          </div>
                          <div className="flex-1 w-full relative">
                            <input 
                              type="number" 
                              className="w-full pr-4 pl-10 py-2 md:py-3 bg-white border border-stone-200 rounded-xl font-bold focus:ring-2 focus:ring-avocado-primary outline-none text-sm md:text-base"
                              value={splitPayments[method.id] || ''}
                              onChange={(e) => setSplitPayments(prev => ({ ...prev, [method.id]: e.target.value }))}
                              placeholder="0.00"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs md:text-sm">{settings.currencySymbol}</span>
                          </div>
                          <button 
                            onClick={() => {
                              const currentPaidOthers = (Object.entries(splitPayments) as [string, string][])
                                .filter(([k]) => k !== method.id)
                                .reduce((sum, [, v]) => sum + parseFloat(v || '0'), 0);
                              const remaining = Math.max(0, total - currentPaidOthers);
                              setSplitPayments(prev => ({ ...prev, [method.id]: remaining.toString() }));
                            }}
                            className="w-full sm:w-auto bg-purple-100 text-purple-700 px-4 py-2 md:py-3 rounded-xl font-bold text-xs md:text-sm hover:bg-purple-200 transition-colors"
                          >
                            تعبئة المتبقي
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-stone-100 p-4 rounded-2xl border border-stone-200">
                        <div className="text-xs text-stone-500 mb-1">إجمالي المدفوع</div>
                        <div className="text-xl font-black text-stone-900">{(splitTotalPaid || 0).toFixed(2)} {settings.currencySymbol}</div>
                      </div>
                      <div className={`p-4 rounded-2xl border ${remainingToPay > 0 ? 'bg-red-50 border-red-100' : 'bg-avocado-light border-avocado-primary/10'}`}>
                        <div className="text-xs text-stone-500 mb-1">المتبقي للإكمال</div>
                        <div className={`text-xl font-black ${remainingToPay > 0 ? 'text-red-600' : 'text-avocado-primary'}`}>
                          {(remainingToPay || 0).toFixed(2)} {settings.currencySymbol}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(paymentMethod === 'Card' || paymentMethod === 'Wallet') && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
                    <div className={`p-6 rounded-full mb-4 ${paymentMethod === 'Card' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                      {paymentMethod === 'Card' ? <CardIcon className="w-16 h-16" /> : <MessageSquare className="w-16 h-16" />}
                    </div>
                    <h3 className="text-2xl font-black mb-2">الدفع عبر {paymentMethod === 'Card' ? 'البطاقة' : 'المحفظة'}</h3>
                    <p className="text-stone-500 max-w-xs">يرجى استخدام جهاز الدفع الخارجي لإتمام العملية بمبلغ {(total || 0).toFixed(2)} {settings.currencySymbol}</p>
                  </div>
                )}

                <div className="mt-auto pt-4 md:pt-8 border-t border-stone-100 flex justify-between items-center">
                  <div className="text-stone-400 font-bold text-sm md:text-base">المبلغ المتبقي (الباقي):</div>
                  <div className="text-2xl md:text-4xl font-black text-avocado-primary">{(change || 0).toFixed(2)} {settings.currencySymbol}</div>
                </div>
              </div>

              {/* Right Side - Summary */}
              <div className="w-full md:w-80 bg-stone-50 p-4 md:p-8 border-t md:border-t-0 md:border-r border-stone-100 flex flex-col overflow-y-auto">
                <h3 className="font-bold text-stone-500 mb-4 md:mb-6 uppercase tracking-wider text-xs md:text-sm">ملخص الفاتورة</h3>
                <div className="flex-1 space-y-4 overflow-y-auto">
                  {orderItems.map(item => (
                    <div key={`${item.id}-${item.size || 'default'}`} className="flex justify-between text-sm">
                      <span className="text-stone-600">{item.quantity} × {item.name}</span>
                      <span className="font-bold">{((item.price || 0) * item.quantity).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t-2 border-dashed border-stone-200 space-y-2">
                  <div className="flex justify-between text-stone-500">
                    <span>المجموع</span>
                    <span>{(subtotal || 0).toFixed(2)} {settings.currencySymbol}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-500">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">الخصم</span>
                      <div className="relative flex items-center">
                        <input 
                          type="number" 
                          className="w-24 p-1.5 border border-red-200 rounded-lg text-right text-sm bg-red-50 focus:ring-2 focus:ring-red-500 outline-none transition-all" 
                          value={globalDiscount || ''} 
                          onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                        {globalDiscount > 0 && (
                          <button 
                            onClick={() => setGlobalDiscount(0)}
                            className="absolute -left-6 p-1 text-red-400 hover:text-red-600 transition-colors"
                            title="مسح الخصم"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="font-bold">-{(globalDiscount || 0).toFixed(2)} {settings.currencySymbol}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-black text-stone-900 pt-2">
                    <span>الإجمالي</span>
                    <span>{(total || 0).toFixed(2)} {settings.currencySymbol}</span>
                  </div>
                </div>
                
                <div className="mt-8 space-y-3">
                  <button 
                    onClick={() => handleCheckout(true)}
                    disabled={
                      isLoading ||
                      (paymentMethod === 'Cash' && cashAmount !== '' && parseFloat(cashAmount) < total) ||
                      (paymentMethod === 'Split' && splitTotalPaid < total)
                    }
                    className="w-full bg-avocado-btn text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-avocado-light disabled:bg-stone-300 transition-all active:scale-95 flex flex-col items-center"
                  >
                    <span>{isLoading ? 'جاري التنفيذ...' : 'تأكيد الدفع والطباعة'}</span>
                    <span className="text-[10px] opacity-80 font-normal">Confirm & Print</span>
                  </button>
                  <button 
                    onClick={() => handleCheckout(false)}
                    disabled={
                      isLoading ||
                      (paymentMethod === 'Cash' && cashAmount !== '' && parseFloat(cashAmount) < total) ||
                      (paymentMethod === 'Split' && splitTotalPaid < total)
                    }
                    className="w-full bg-stone-800 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-stone-200 disabled:bg-stone-300 transition-all active:scale-95 flex flex-col items-center"
                  >
                    <span>{isLoading ? 'جاري التنفيذ...' : 'تأكيد الدفع فقط'}</span>
                    <span className="text-[10px] opacity-80 font-normal">Confirm Only</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Size Selection Modal */}
      <AnimatePresence>
        {isSizeModalOpen && selectedProductForSize && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsSizeModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden relative z-10"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-stone-800">اختر الحجم</h3>
                  <button onClick={() => setIsSizeModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <img src={selectedProductForSize.image} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  <div>
                    <div className="font-black text-lg">{selectedProductForSize.name}</div>
                    <div className="text-stone-400 text-sm">{selectedProductForSize.category}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {(['S', 'M', 'L'] as const).map((size) => {
                    const price = selectedProductForSize.prices ? (selectedProductForSize.prices as any)[size] : selectedProductForSize.price;
                    return (
                      <button
                        key={size}
                        onClick={() => addToOrder(selectedProductForSize, size)}
                        className="flex items-center justify-between p-5 bg-white border-2 border-stone-100 rounded-2xl hover:border-avocado-primary hover:bg-avocado-light/30 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center font-black text-xl text-stone-600 group-hover:bg-avocado-primary group-hover:text-white transition-colors">
                            {size}
                          </div>
                          <div className="font-bold text-lg">
                            {size === 'S' ? 'صغير (Small)' : size === 'M' ? 'وسط (Medium)' : 'كبير (Large)'}
                          </div>
                        </div>
                        <div className="font-black text-xl text-avocado-primary">
                          {(price || 0).toFixed(2)} {settings.currencySymbol}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Held Orders Modal */}
      <AnimatePresence>
        {isHeldOrdersOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black">الطلبات المعلقة</h2>
                <button onClick={() => setIsHeldOrdersOpen(false)} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {heldOrders.length > 0 ? heldOrders.map(held => (
                  <div key={held.id} className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-lg">{held.customerName || 'عميل بدون اسم'}</div>
                      <div className="text-xs text-stone-400">
                        {(() => {
                          try {
                            return held.date ? new Date(held.date).toLocaleString('ar-EG') : 'بدون تاريخ';
                          } catch (e) {
                            return 'تاريخ غير صالح';
                          }
                        })()} • {held.items.length} أصناف
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resumeOrder(held)} className="bg-avocado-btn text-white px-6 py-2 rounded-xl font-bold hover:bg-avocado-primary transition-colors">استرجاع</button>
                      {currentUser?.role === 'Admin' && (
                        <button 
                          onClick={async () => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'حذف طلب معلق',
                              message: 'هل أنت متأكد من حذف هذا الطلب المعلق؟',
                              type: 'danger',
                              onConfirm: async () => {
                                try {
                                  await deleteDoc(doc(db, 'heldOrders', held.id));
                                  setShowToast('تم حذف الطلب المعلق');
                                  setTimeout(() => setShowToast(null), 3000);
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, `heldOrders/${held.id}`);
                                }
                              }
                            });
                          }} 
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-stone-300">لا توجد طلبات معلقة حالياً</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-avocado-light text-avocado-primary rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">تفاصيل الفاتورة {selectedInvoice.orderNumber}</h2>
                    <p className="text-xs text-stone-500">{new Date(selectedInvoice.date).toLocaleString('ar-EG')}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-stone-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8" ref={invoiceDetailsRef}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">الكاشير</div>
                    <div className="font-bold text-stone-700">{selectedInvoice.cashierName}</div>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">العميل</div>
                    <div className="font-bold text-stone-700">{selectedInvoice.customerName || 'عميل نقدي'}</div>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">طريقة الدفع</div>
                    <div className="font-bold text-stone-700">{selectedInvoice.paymentMethod}</div>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">الحالة</div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedInvoice.status === 'Paid' ? 'bg-avocado-light text-avocado-secondary' : 
                      selectedInvoice.status === 'Refunded' ? 'bg-red-100 text-red-700' : 
                      selectedInvoice.status === 'Partially Refunded' ? 'bg-orange-100 text-orange-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {selectedInvoice.status === 'Paid' ? 'تم الدفع' : selectedInvoice.status === 'Refunded' ? 'مرتجع' : selectedInvoice.status === 'Partially Refunded' ? 'مرتجع جزئياً' : 'ملغي'}
                    </span>
                  </div>
                </div>

                {selectedInvoice.refundedItems && selectedInvoice.refundedItems.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-bold text-red-600 mb-4 flex items-center gap-2">
                      <History className="w-4 h-4" /> المنتجات المرتجعة
                    </h3>
                    <div className="border border-red-100 rounded-2xl overflow-x-auto bg-red-50/30">
                      <table className="w-full text-right min-w-[600px]">
                        <thead className="bg-red-50 text-xs font-bold text-red-500">
                          <tr>
                            <th className="p-3">المنتج</th>
                            <th className="p-3">الكمية المرتجعة</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">السبب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-50">
                          {selectedInvoice.refundedItems.map((ri, idx) => {
                            const item = selectedInvoice.items.find(i => i.id === ri.productId);
                            return (
                              <tr key={idx}>
                                <td className="p-3 text-sm font-bold">{item?.name || 'منتج غير معروف'}</td>
                                <td className="p-3 text-sm">{ri.quantity}</td>
                                <td className="p-3 text-sm">{new Date(ri.date).toLocaleDateString('ar-EG')}</td>
                                <td className="p-3 text-sm italic">{ri.reason}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                  <div className="border border-stone-100 rounded-2xl overflow-x-auto">
                    <table className="w-full text-right min-w-[600px]">
                      <thead className="bg-stone-50 text-xs font-bold text-stone-500">
                        <tr>
                          <th className="p-3">المنتج</th>
                          <th className="p-3">الكمية</th>
                          <th className="p-3">السعر</th>
                          <th className="p-3">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {selectedInvoice.items.map(item => (
                          <tr key={item.id + (item.size || '')}>
                            <td className="p-3 text-sm font-bold">
                              <div>{item.name}</div>
                              {item.size && <div className="text-[10px] text-avocado-primary">الحجم: {item.size}</div>}
                            </td>
                            <td className="p-3 text-sm">{item.quantity}</td>
                            <td className="p-3 text-sm">{(item.manualPrice ?? item.price ?? 0).toFixed(2)} {settings.currencySymbol}</td>
                            <td className="p-3 text-sm font-bold">{((item.manualPrice ?? item.price ?? 0) * item.quantity).toFixed(2)} {settings.currencySymbol}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <div className="flex justify-between text-stone-500">
                      <span>المجموع الفرعي:</span>
                      <span>{(selectedInvoice.subtotal || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span>الخصم:</span>
                      <span>-{(selectedInvoice.discount || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-stone-700 pt-2 border-t border-stone-100">
                      <span>إجمالي الفاتورة (Gross):</span>
                      <span>{(selectedInvoice.total || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    {selectedInvoice.refundedItems && selectedInvoice.refundedItems.length > 0 && (
                      <>
                        <div className="flex justify-between text-red-600 font-bold">
                          <span>إجمالي المرتجعات:</span>
                          <span>-{(selectedInvoice.refundedItems.reduce((sum, ri) => {
                            const item = selectedInvoice.items.find(it => it.id === ri.productId);
                            const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
                            return sum + (itemPrice * ri.quantity);
                          }, 0)).toFixed(2)} {settings.currencySymbol}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black text-avocado-primary pt-2 border-t-2 border-avocado-light">
                          <span>الصافي النهائي (Net):</span>
                          <span>{(selectedInvoice.total - selectedInvoice.refundedItems.reduce((sum, ri) => {
                            const item = selectedInvoice.items.find(it => it.id === ri.productId);
                            const itemPrice = item ? (item.manualPrice !== undefined ? item.manualPrice : item.price) : 0;
                            return sum + (itemPrice * ri.quantity);
                          }, 0)).toFixed(2)} {settings.currencySymbol}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">المبلغ المدفوع:</span>
                      <span className="font-bold">{(selectedInvoice.cashPaid || selectedInvoice.total || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">المتبقي (الباقي):</span>
                      <span className="font-bold text-avocado-primary">{(selectedInvoice.change || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.status === 'Refunded' && (
                  <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4" /> تم إرجاع هذه الفاتورة
                    </div>
                    <p className="text-xs text-red-600">السبب: {selectedInvoice.refundReason || 'غير محدد'}</p>
                    <p className="text-[10px] text-red-400 mt-1">تاريخ الإرجاع: {new Date(selectedInvoice.refundDate!).toLocaleString('ar-EG')}</p>
                  </div>
                )}

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
                <button 
                  onClick={() => {
                    triggerReceiptPrint(selectedInvoice, false, settings);
                  }}
                  className="flex-1 bg-stone-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-900 transition-all"
                >
                  <Printer className="w-5 h-5" /> إعادة طباعة
                </button>
                {selectedInvoice.status === 'Paid' && (
                  <button 
                    onClick={() => setIsRefundModalOpen(true)}
                    className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    <History className="w-5 h-5" /> إرجاع الفاتورة
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Refund Modal */}
      <AnimatePresence>
        {isRefundModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-red-600">إرجاع منتجات من الفاتورة</h2>
                <button onClick={() => setIsRefundModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-red-700">الفاتورة رقم: <span className="font-bold">{selectedInvoice.orderNumber}</span></p>
                    <p className="text-xs text-red-600">سيتم إعادة المنتجات المختارة إلى المخزون.</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-stone-500">تاريخ الفاتورة</p>
                    <p className="text-sm font-bold text-stone-700">{new Date(selectedInvoice.date).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                  {selectedInvoice.items.map((item, idx) => {
                    const alreadyRefunded = (selectedInvoice.refundedItems || [])
                      .filter(ri => ri.productId === item.id)
                      .reduce((acc, ri) => acc + ri.quantity, 0);
                    const availableToRefund = item.quantity - alreadyRefunded;
                    
                    if (availableToRefund <= 0) return null;

                    return (
                      <div key={`${item.id}-${idx}`} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="flex-1">
                          <p className="font-bold text-stone-800">{item.name}</p>
                          <p className="text-xs text-stone-500">المباع: {item.quantity} | المرتجع سابقاً: {alreadyRefunded}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setRefundQuantities(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                            className="w-8 h-8 flex items-center justify-center bg-white border border-stone-200 rounded-lg hover:bg-stone-50"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-red-600">{refundQuantities[item.id] || 0}</span>
                          <button 
                            onClick={() => setRefundQuantities(prev => ({ ...prev, [item.id]: Math.min(availableToRefund, (prev[item.id] || 0) + 1) }))}
                            className="w-8 h-8 flex items-center justify-center bg-white border border-stone-200 rounded-lg hover:bg-stone-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">سبب الإرجاع</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-avocado-primary h-24 resize-none"
                    placeholder="اكتب سبب الإرجاع هنا..."
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  ></textarea>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsRefundModalOpen(false)}
                    className="flex-1 py-3 border border-stone-200 rounded-xl font-bold text-stone-600 hover:bg-stone-50 transition-all"
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={() => {
                      setIsPrintingRefund(true);
                      handleRefund(selectedInvoice.id);
                    }}
                    disabled={!refundReason.trim() || Object.values(refundQuantities).every(q => q === 0)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:bg-stone-300"
                  >
                    تأكيد الإرجاع والطباعة
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <h3 className="text-xl font-black text-stone-800">{editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={saveUser} className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600 block">الاسم الكامل</label>
                    <input 
                      name="name"
                      type="text" 
                      required
                      value={editingUser?.name || ''}
                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, name: e.target.value } : { name: e.target.value } as UserType)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600 block">البريد الإلكتروني</label>
                    <input 
                      name="email"
                      type="email" 
                      required
                      value={editingUser?.email || ''}
                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : { email: e.target.value } as UserType)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600 block">كلمة المرور {editingUser?.id && '(اتركها فارغة إذا لم ترد التغيير)'}</label>
                    <input 
                      name="password"
                      type="password" 
                      required={!editingUser?.id}
                      value={editingUser?.password || ''}
                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, password: e.target.value } : { password: e.target.value } as UserType)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                    {editingUser?.id && (
                      <p className="text-xs text-amber-600 mt-1">
                        ملاحظة: تغيير كلمة المرور هنا يغيرها في النظام فقط. لتغييرها في شاشة الدخول يجب حذف المستخدم وإضافته من جديد.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600 block">الدور (الصلاحية)</label>
                    <select 
                      name="role"
                      required
                      value={editingUser?.role || 'Cashier'}
                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, role: e.target.value as UserRole } : { role: e.target.value as UserRole } as UserType)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    >
                      <option value="Admin">Admin (مدير كامل)</option>
                      <option value="Manager">Manager (مشرف)</option>
                      <option value="Cashier">Cashier (كاشير)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-stone-50 border border-stone-200 rounded-xl">
                    <input 
                      type="checkbox" 
                      name="isHidden" 
                      id="isHidden"
                      checked={editingUser?.isHidden || false}
                      onChange={(e) => setEditingUser(prev => prev ? { ...prev, isHidden: e.target.checked } : { isHidden: e.target.checked } as UserType)}
                      className="w-5 h-5 text-avocado-primary rounded border-stone-300 focus:ring-avocado-primary"
                    />
                    <label htmlFor="isHidden" className="text-sm font-bold text-stone-600 cursor-pointer">
                      إخفاء هذا المستخدم من شاشة تسجيل الدخول
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-avocado-btn text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-avocado-dark/20 hover:bg-avocado-primary transition-all"
                  >
                    حفظ البيانات
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-xl font-bold text-lg hover:bg-stone-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${confirmDialog.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                {confirmDialog.type === 'danger' ? <Trash2 className="w-10 h-10" /> : <Plus className="w-10 h-10" />}
              </div>
              <h2 className="text-2xl font-black mb-2">{confirmDialog.title}</h2>
              <p className="text-stone-500 mb-8">{confirmDialog.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }}
                  className={`flex-1 py-4 rounded-2xl font-black text-white transition-all active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  تأكيد
                </button>
                <button 
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black hover:bg-stone-200 transition-all active:scale-95"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              showToast.type === 'success' 
                ? 'bg-stone-900 text-white border-white/10' 
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {showToast.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-avocado-primary" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-white" />
            )}
            <span className="font-bold text-lg">{showToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Receipt Template (Hidden on screen) */}
      <div className={`hidden print:block p-4 bg-white text-black font-mono ${settings.isThermalPrinter ? 'w-[80mm]' : 'w-[210mm]'} mx-auto`} dir="rtl">
        {isKitchenPrint ? (
          <div className={`${settings.isThermalPrinter ? 'max-w-xs' : 'max-w-2xl'} mx-auto`}>
            <div className="text-center mb-4">
              <h1 className="text-2xl font-black uppercase border-b-2 border-black pb-2">طلب مطبخ (Kitchen Order)</h1>
              <div className="flex justify-between mt-4 text-lg font-bold">
                <span>رقم الطلب: {orderNumber}</span>
                <span>الوقت: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-right mt-2 font-bold">
                <span>الكاشير: {currentUser?.name}</span>
              </div>
              <div className="border-b border-dashed my-4"></div>
            </div>

            <div className="mb-4">
              {orderItems.map((item, idx) => (
                <div key={idx} className="mb-4 border-b border-stone-100 pb-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xl font-black">{item.quantity} × {item.name} {item.size ? `(${item.size})` : ''}</span>
                  </div>
                  {item.note && (
                    <div className="mt-1 p-2 bg-stone-50 border-r-4 border-black text-lg font-bold">
                      ملاحظة: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-8 pt-4 border-t-2 border-black">
              <p className="text-sm font-bold italic">نهاية الطلب</p>
            </div>
          </div>
        ) : isPrintingRefund ? (
          <div className={`${settings.isThermalPrinter ? 'max-w-xs' : 'max-w-2xl'} mx-auto`}>
            <div className="text-center mb-4">
              {settings.storeLogo && <img src={settings.storeLogo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />}
              <h1 className="text-xl font-bold uppercase">إيصال مرتجع</h1>
              <p className="text-sm font-bold">{settings.storeName}</p>
              <p className="text-[10px]">{settings.storeAddress}</p>
              <div className="flex justify-center gap-4 text-[10px]">
                {settings.storePhone && <span>هاتف: {settings.storePhone}</span>}
                {settings.storeEmail && <span>بريد: {settings.storeEmail}</span>}
              </div>
              <div className="border-b border-dashed my-2"></div>
            </div>

            <div className="space-y-1 mb-2 text-[10px]">
              {selectedInvoice && (
                <div className="flex justify-between">
                  <span>رقم الفاتورة الأصلية:</span>
                  <span className="font-bold">{selectedInvoice.orderNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>تاريخ المرتجع:</span>
                <span>{new Date().toLocaleString('ar-EG')}</span>
              </div>
              <div className="flex justify-between">
                <span>الكاشير:</span>
                <span>{currentUser?.name}</span>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between border-b border-dashed pb-1 mb-1 font-bold">
                <span className="w-1/2">الصنف</span>
                <span className="w-1/4 text-center">الكمية</span>
                <span className="w-1/4 text-left">المجموع</span>
              </div>
              {isReturnMode && lastInvoice ? (
                lastInvoice.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex justify-between mb-1">
                    <span className="w-1/2 truncate">{item.name}</span>
                    <span className="w-1/4 text-center">{Math.abs(item.quantity)}</span>
                    <span className="w-1/4 text-left">{Math.abs((item.manualPrice ?? item.price ?? 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                Object.entries(refundQuantities).filter(([_, qty]) => (qty as number) > 0).map(([productId, qty]) => {
                  const item = selectedInvoice?.items.find(i => i.id === productId);
                  return (
                    <div key={productId} className="flex justify-between mb-1">
                      <span className="w-1/2 truncate">{item?.name}</span>
                      <span className="w-1/4 text-center">{qty as number}</span>
                      <span className="w-1/4 text-left">{((item?.price || 0) * (qty as number)).toFixed(2)}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-dashed pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between font-bold text-sm">
                <span>إجمالي المرتجع:</span>
                <span>
                  {isReturnMode && lastInvoice ? (
                    Math.abs(lastInvoice.total || 0).toFixed(2)
                  ) : (
                    Object.entries(refundQuantities).reduce((acc, [pid, qty]) => {
                      const item = selectedInvoice?.items.find(i => i.id === pid);
                      return acc + (item ? item.price * (qty as number) : 0);
                    }, 0).toFixed(2)
                  )} {settings.currencySymbol}
                </span>
              </div>
              {!isReturnMode && (
                <div className="text-[10px] text-stone-500 mt-2">
                  <p className="font-bold underline">سبب الإرجاع:</p>
                  <p>{refundReason}</p>
                </div>
              )}
            </div>

            <div className="text-center mt-8 pt-4 border-t border-dashed">
              <p className="text-[10px] font-bold italic">{settings.invoiceFooter || 'شكراً لتعاملكم معنا'}</p>
            </div>
          </div>
        ) : lastInvoice ? (
          <div className={`${settings.isThermalPrinter ? 'max-w-xs' : 'max-w-2xl'} mx-auto`}>
            {settings.invoiceLayout !== 'compact' && (
              <div className="text-center mb-4">
                {settings.storeLogo && <img src={settings.storeLogo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />}
                <h1 className="text-xl font-bold uppercase">{settings.storeName}</h1>
                <p className="text-[10px]">{settings.storeAddress}</p>
                <div className="flex justify-center gap-4 text-[10px]">
                  {settings.storePhone && <span>هاتف: {settings.storePhone}</span>}
                  {settings.storeEmail && <span>بريد: {settings.storeEmail}</span>}
                </div>
              </div>
            )}

            {settings.invoiceLayout === 'compact' && (
              <div className="text-center mb-2">
                <h1 className="text-lg font-bold">{settings.storeName}</h1>
                <p className="text-[8px]">{settings.storePhone}</p>
              </div>
            )}
            
            <div className="border-y border-dashed py-2 mb-2 text-[10px] space-y-1">
              {settings.showOrderNumber && <div className="flex justify-between"><span>رقم الفاتورة:</span> <span>{lastInvoice?.orderNumber}</span></div>}
              <div className="flex justify-between"><span>التاريخ والوقت:</span> <span>{lastInvoice ? new Date(lastInvoice.date).toLocaleString('ar-EG') : ''}</span></div>
              {settings.showCashierName && <div className="flex justify-between"><span>الكاشير:</span> <span>{lastInvoice?.cashierName}</span></div>}
              {lastInvoice?.customerName && <div className="flex justify-between"><span>العميل:</span> <span>{lastInvoice.customerName}</span></div>}
            </div>

            <div className="mb-2">
              <div className="flex justify-between border-b border-dashed pb-1 mb-1 font-bold">
                <span className="w-1/2">الصنف</span>
                <span className="w-1/4 text-center">الكمية</span>
                <span className="w-1/4 text-left">المجموع</span>
              </div>
              {lastInvoice?.items.map(item => (
                <div key={item.id + (item.size || '')} className="mb-1">
                  <div className="flex justify-between">
                    <span className="w-1/2 truncate">{item.name} {item.size ? `(${item.size})` : ''}</span>
                    <span className="w-1/4 text-center">{item.quantity}</span>
                    <span className="w-1/4 text-left">{((item.manualPrice ?? item.price ?? 0) * item.quantity).toFixed(2)}</span>
                  </div>
                  {settings.invoiceLayout === 'detailed' && (item.discount || 0) > 0 && (
                    <div className="text-[9px] text-right text-stone-500">- خصم: {(item.discount || 0).toFixed(2)}</div>
                  )}
                  {settings.invoiceLayout === 'detailed' && item.note && (
                    <div className="text-[8px] text-stone-400 italic">ملاحظة: {item.note}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-dashed pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between text-[10px]"><span>المجموع الفرعي:</span> <span>{(lastInvoice?.subtotal || 0).toFixed(2)} {settings.currencySymbol}</span></div>
              <div className="flex justify-between text-[10px]"><span>الخصم الإجمالي:</span> <span>-{(lastInvoice?.discount || 0).toFixed(2)} {settings.currencySymbol}</span></div>
              <div className="flex justify-between font-bold text-sm border-t border-dashed pt-1"><span>الإجمالي النهائي:</span> <span>{(lastInvoice?.total || 0).toFixed(2)} {settings.currencySymbol}</span></div>
            </div>

            <div className="border-t border-dashed mt-2 pt-2 space-y-1 text-[10px]">
              {settings.invoiceLayout !== 'compact' && <div className="flex justify-between font-bold mb-1"><span>تفاصيل الدفع:</span></div>}
              {lastInvoice?.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{p.method === 'Cash' ? 'نقدي' : p.method === 'Card' ? 'بطاقة' : 'محفظة'}:</span>
                  <span>{(p.amount || 0).toFixed(2)} {settings.currencySymbol}</span>
                </div>
              ))}
              {lastInvoice?.paymentMethod === 'Cash' && lastInvoice.change && lastInvoice.change > 0 && (
                <div className="flex justify-between font-bold border-t border-dotted mt-1 pt-1">
                  <span>المبلغ المتبقي (الباقي):</span>
                  <span>{(lastInvoice.change || 0).toFixed(2)} {settings.currencySymbol}</span>
                </div>
              )}
            </div>

            <div className="text-center mt-6 pt-2 border-t border-dashed">
              <p className="font-bold text-[10px]">{settings.invoiceFooter}</p>
              {settings.invoiceLayout === 'detailed' && <p className="text-[8px]">الأسعار تشمل ضريبة القيمة المضافة</p>}
            </div>
          </div>
        ) : null}
      </div>
      {/* Register Modals */}
      <OpenRegisterModal 
        isOpen={isOpenRegisterOpen}
        onClose={() => setIsOpenRegisterOpen(false)}
        onOpen={handleOpenRegister}
        cashierName={currentUser?.name || ''}
        settings={settings}
      />
      
      {activeSession && (
        <CloseRegisterModal 
          isOpen={isCloseRegisterOpen}
          onClose={() => setIsCloseRegisterOpen(false)}
          onConfirm={handleCloseRegister}
          session={activeSession}
          summary={registerSummary}
          settings={settings}
        />
      )}

      <PrintStudio 
        request={receiptRequest}
        onClose={clearReceiptPrint}
        systemSettings={settings}
        onSettingsChange={(newSettings) => {
          // Update the receipt request settings if needed
          // This is useful if the user manually changes settings in the preview
          if (receiptRequest) {
            triggerReceiptPrint(receiptRequest.data, false, { ...settings, ...newSettings });
          }
        }}
      />

      <PrintStudio 
        request={kitchenRequest}
        onClose={clearKitchenPrint}
        systemSettings={settings}
        onSettingsChange={(newSettings) => {
          if (kitchenRequest) {
            triggerKitchenPrint(kitchenRequest.data, false, { ...settings, ...newSettings });
          }
        }}
      />

      {/* Session Details Modal */}
      <AnimatePresence>
        {viewingSession && viewingSessionSummary && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-stone-800 text-white rounded-xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">تفاصيل الجلسة</h2>
                    <p className="text-xs text-stone-500">كاشير: {viewingSession.userName}</p>
                  </div>
                </div>
                <div className="flex bg-stone-200 p-1 rounded-lg">
                  <button 
                    onClick={() => setSessionViewMode('detailed')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${sessionViewMode === 'detailed' ? 'bg-avocado-primary text-white' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    تفصيلي
                  </button>
                  <button 
                    onClick={() => setSessionViewMode('simple')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${sessionViewMode === 'simple' ? 'bg-avocado-primary text-white' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    ملخص
                  </button>
                </div>
                <button onClick={() => setViewingSession(null)} className="p-2 hover:bg-stone-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">وقت الفتح</p>
                    <p className="text-sm font-bold">{new Date(viewingSession.openingTime).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">وقت الإغلاق</p>
                    <p className="text-sm font-bold">{viewingSession.closingTime ? new Date(viewingSession.closingTime).toLocaleString('ar-EG') : 'لا تزال مفتوحة'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {sessionViewMode === 'detailed' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                          <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">المبلغ الابتدائي</p>
                          <p className="text-xl font-black">{(viewingSession.openingCash || 0).toFixed(2)} {settings.currencySymbol}</p>
                        </div>
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                          <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">عدد الفواتير</p>
                          <p className="text-xl font-black">{viewingSessionSummary.invoiceCount}</p>
                        </div>
                      </div>

                      <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500 text-sm">مبيعات نقدية</span>
                          <span className="font-bold">{(viewingSessionSummary.cashSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500 text-sm">مبيعات بطاقة</span>
                          <span className="font-bold">{(viewingSessionSummary.cardSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500 text-sm">مبيعات أخرى</span>
                          <span className="font-bold">{(viewingSessionSummary.mixedSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                        </div>
                        <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-avocado-primary">
                          <span className="font-bold">إجمالي المبيعات</span>
                          <span className="text-xl font-black">{(viewingSessionSummary.totalSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
                        <span className="text-red-600 text-sm font-bold">إجمالي المرتجعات</span>
                        <span className="text-red-600 font-bold">-{(viewingSessionSummary.refunds || 0).toFixed(2)} {settings.currencySymbol}</span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6 py-4">
                      <div className="text-center p-8 bg-stone-50 rounded-3xl border border-stone-100">
                        <p className="text-stone-400 text-xs font-bold uppercase mb-2">صافي المبيعات</p>
                        <p className="text-4xl font-black text-avocado-primary">
                          {(viewingSessionSummary.totalSales - viewingSessionSummary.refunds).toFixed(2)} {settings.currencySymbol}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-2">(إجمالي المبيعات - إجمالي المرتجعات)</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-center">
                          <p className="text-stone-400 text-[10px] font-bold mb-1">المبيعات</p>
                          <p className="text-lg font-black">{viewingSessionSummary.totalSales.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-center">
                          <p className="text-red-600/50 text-[10px] font-bold mb-1">المرتجعات</p>
                          <p className="text-lg font-black text-red-600">{viewingSessionSummary.refunds.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-stone-900 text-white rounded-2xl border border-stone-800">
                      <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">المبلغ المتوقع (نقدي)</p>
                      <p className="text-xl font-black">{(viewingSession.expectedCash || 0).toFixed(2)} {settings.currencySymbol}</p>
                    </div>
                    <div className="p-4 bg-stone-900 text-white rounded-2xl border border-stone-800">
                      <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">المبلغ الفعلي</p>
                      <p className="text-xl font-black">{(viewingSession.closingCash || 0).toFixed(2)} {settings.currencySymbol}</p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    (viewingSession.difference || 0) === 0 ? 'bg-green-50 border-green-200 text-green-700' :
                    (viewingSession.difference || 0) > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <span className="font-bold">الفرق في الصندوق:</span>
                    <span className="text-xl font-black">{(viewingSession.difference || 0).toFixed(2)} {settings.currencySymbol}</span>
                  </div>

                  {viewingSession.notes && (
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <p className="text-stone-400 text-[10px] uppercase font-bold mb-1">ملاحظات</p>
                      <p className="text-sm italic text-stone-600">{viewingSession.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100">
                <button 
                  onClick={() => setViewingSession(null)}
                  className="w-full py-4 bg-stone-200 text-stone-700 rounded-2xl font-black hover:bg-stone-300 transition-all"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
