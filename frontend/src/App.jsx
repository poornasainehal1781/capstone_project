import React, { useState, useEffect } from 'react';
import { MOCK_USERS } from './data/mockData';
import { authApi } from './services/authApi';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { AICopilotDrawer } from './components/ai/AICopilotDrawer';

// 12 Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POSBilling } from './pages/POSBilling';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Inventory } from './pages/Inventory';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { PurchaseManagement } from './pages/PurchaseManagement';
import { SalesReports } from './pages/SalesReports';
import { AIInsights } from './pages/AIInsights';
import { UserManagement } from './pages/UserManagement';

export function App() {
  const [currentUser, setCurrentUser] = useState(null); // null = unauthenticated
  const [activePage, setActivePage] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Validate stored JWT token on startup
  useEffect(() => {
    const restoreSession = async () => {
      const token = authApi.getToken();
      if (!token) {
        setSessionLoading(false);
        return;
      }

      try {
        const me = await authApi.getMe();
        if (me) {
          const userObj = {
            id: me.id,
            name: me.full_name,
            username: me.username,
            email: me.email,
            role: me.role,
            status: me.is_active ? "Active" : "Inactive",
            permissions: me.permissions,
            avatar:
              me.role === "ADMIN"
                ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                : me.role === "MANAGER"
                ? "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80"
                : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
          };
          setCurrentUser(userObj);
          if (userObj.role === "CASHIER") {
            setActivePage("pos");
          }
        }
      } catch (err) {
        console.warn("Session restore failed or expired:", err.message);
        authApi.clearToken();
        setCurrentUser(null);
      } finally {
        setSessionLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Authentication Handlers
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'CASHIER') {
      setActivePage('pos');
    } else {
      setActivePage('dashboard');
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    setActivePage('dashboard');
  };

  const handleSwitchUser = async (targetRole) => {
    // Convenient fast switcher for demonstration & testing
    const credentials = {
      ADMIN: { u: "admin_rajesh", p: "Admin@123" },
      MANAGER: { u: "mgr_priya", p: "Manager@123" },
      CASHIER: { u: "cashier_karan", p: "Cashier@123" },
    };

    const cred = credentials[targetRole];
    if (cred) {
      try {
        const res = await authApi.login(cred.u, cred.p);
        const switched = {
          id: res.user.id,
          name: res.user.full_name,
          username: res.user.username,
          email: res.user.email,
          role: res.user.role,
          status: "Active",
          token: res.access_token,
          avatar:
            res.user.role === "ADMIN"
              ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
              : res.user.role === "MANAGER"
              ? "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80"
              : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
        };
        handleLoginSuccess(switched);
      } catch (err) {
        // Fallback for offline demo
        const localUser = MOCK_USERS.find((u) => u.role === targetRole) || MOCK_USERS[0];
        handleLoginSuccess(localUser);
      }
    }
  };

  // Safe navigation with RBAC enforcement
  const handleNavigate = (page) => {
    // Cashier restricted from Admin and Manager views
    if (currentUser?.role === 'CASHIER' && ['users', 'inventory', 'suppliers', 'purchases'].includes(page)) {
      alert(`Access Restricted: Cashier role does not have authorization to view '${page}'. Opening POS register.`);
      setActivePage('pos');
      return;
    }

    // Manager restricted from User Management
    if (currentUser?.role === 'MANAGER' && page === 'users') {
      alert("Access Restricted: Staff User Management is restricted to System Administrators.");
      setActivePage('dashboard');
      return;
    }

    setActivePage(page);
  };

  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <span>Restoring authenticated session...</span>
      </div>
    );
  }

  // If unauthenticated, show Login Screen
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Responsive Sidebar */}
      <Sidebar
        activePage={activePage}
        setActivePage={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-w-0">
        {/* Sticky Topbar */}
        <Topbar
          activePage={activePage}
          setActivePage={handleNavigate}
          currentUser={currentUser}
          setMobileOpen={setMobileOpen}
          onOpenAICopilot={() => setIsAICopilotOpen(true)}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <Dashboard
              setActivePage={handleNavigate}
              onOpenAICopilot={() => setIsAICopilotOpen(true)}
            />
          )}

          {activePage === 'pos' && (
            <POSBilling
              currentUser={currentUser}
            />
          )}

          {activePage === 'products' && (
            <Products />
          )}

          {activePage === 'categories' && (
            <Categories />
          )}

          {activePage === 'inventory' && (
            <Inventory
              onOpenAICopilot={() => setIsAICopilotOpen(true)}
            />
          )}

          {activePage === 'customers' && (
            <Customers />
          )}

          {activePage === 'suppliers' && (
            <Suppliers
              setActivePage={handleNavigate}
            />
          )}

          {activePage === 'purchases' && (
            <PurchaseManagement
              setActivePage={handleNavigate}
            />
          )}

          {activePage === 'reports' && (
            <SalesReports currentUser={currentUser} />
          )}

          {activePage === 'ai-insights' && (
            <AIInsights
              setActivePage={handleNavigate}
              onOpenAICopilot={() => setIsAICopilotOpen(true)}
            />
          )}

          {activePage === 'users' && (
            <UserManagement
              currentUser={currentUser}
            />
          )}
        </main>
      </div>

      {/* Slide-out AI Copilot Drawer */}
      <AICopilotDrawer
        isOpen={isAICopilotOpen}
        onClose={() => setIsAICopilotOpen(false)}
        onNavigate={(page) => handleNavigate(page)}
      />
    </div>
  );
}

export default App;
