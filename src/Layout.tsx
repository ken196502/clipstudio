import { useState, useEffect } from 'react';
import { useAppStore } from './store';
import { Users, Activity, Film, Search as SearchIcon, Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import KOLManager from './pages/KOLManager';
import TaskMonitor from './pages/TaskMonitor';
import ClipLibrary from './pages/ClipLibrary';
import SearchPage from './pages/Search';


export default function Layout() {
  const { activePage, setActivePage } = useAppStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
  }, []);


  const navItems = [
    { id: 'search', label: 'SYNAPTIC SEARCH', icon: SearchIcon },
    { id: 'kol', label: 'TARGET ENTITIES', icon: Users },
    { id: 'task', label: 'PROCESS MONITOR', icon: Activity },
    { id: 'clip', label: 'VERTICAL CLIPS', icon: Film },
  ] as const;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans selection:bg-cyan-500/30">
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#f4f4f5',
          },
          classNames: {
            error: 'border-rose-500/50',
            success: 'border-emerald-500/50',
            warning: 'border-amber-500/50',
          }
        }}
      />
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 256 : 64 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="border-r border-zinc-800 bg-zinc-950 flex flex-col relative z-20 shrink-0"
      >
        <div className="h-16 flex items-center px-4 border-b border-zinc-800 shrink-0 justify-between overflow-hidden">
          <div className="flex items-center gap-3 text-zinc-100 font-display font-bold tracking-wider shrink-0 w-48">
            <div className="p-1 px-1.5 bg-zinc-100 text-zinc-950 rounded-sm shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
            <motion.span 
              initial={false}
              animate={{ opacity: isSidebarOpen ? 1 : 0, display: isSidebarOpen ? 'block' : 'none' }}
              transition={{ duration: 0.2 }}
              className="text-lg whitespace-nowrap"
            >
              ENGINE_VEC
            </motion.span>
          </div>
        </div>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full p-1 hover:text-cyan-400 hover:border-cyan-500 transition-colors z-30"
        >
          {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <nav className="flex-1 py-6 px-2 space-y-2 overflow-x-hidden">
          <motion.div 
            initial={false}
            animate={{ opacity: isSidebarOpen ? 1 : 0 }}
            className="text-xs font-mono text-zinc-600 mb-4 px-3 uppercase tracking-widest font-bold whitespace-nowrap"
          >
            {isSidebarOpen ? 'Control Panel' : ''}
          </motion.div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-xs font-bold font-display tracking-widest uppercase transition-all duration-200 border-l-2 group hover-sweep hover-fx hover:scale-[1.02] mb-1",
                  isActive 
                    ? "bg-zinc-900 border-amber-500 text-zinc-100 shadow-[inset_0_0_12px_rgba(245,158,11,0.1)]" 
                    : "border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
                )}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <Icon className={cn("w-4 h-4 shrink-0 group-hover-wiggle", isActive ? "text-amber-500" : "text-zinc-600 group-hover:text-amber-500")} />
                  <motion.span
                     initial={false}
                     animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }}
                     className="whitespace-nowrap overflow-hidden text-left"
                  >
                    {item.label}
                  </motion.span>
                </div>
                <AnimatePresence>
                  {isActive && isSidebarOpen && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="w-1.5 h-1.5 bg-amber-500 rounded-sm shadow-[0_0_8px_rgba(245,158,11,0.8)] shrink-0" 
                    />
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>
        {/* Status indicator bottom */}
        <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950 overflow-hidden">
           <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold tracking-widest font-mono text-zinc-500 whitespace-nowrap overflow-hidden">
             <span className="w-2 h-2 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse shrink-0" />
             <motion.span
                initial={false}
                animate={{ opacity: isSidebarOpen ? 1 : 0, width: isSidebarOpen ? 'auto' : 0 }}
             >
               SQ_VEC ONLINE
             </motion.span>
           </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-zinc-900/50">
        {/* Technical grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute inset-0 bg-radial-[at_50%_0%] from-transparent to-zinc-950 pointer-events-none" />
        
        {/* 20% transparent white polygon animation background */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-20">
          <motion.svg className="w-full h-full text-white" viewBox="0 0 100 100" preserveAspectRatio="none">
             <motion.polygon
               fill="none"
               stroke="currentColor"
               strokeWidth="0.5"
               points="10,10 90,20 80,90 20,80"
               animate={{
                 points: [
                   "10,10 90,20 80,90 20,80",
                   "20,20 80,10 90,80 10,90",
                   "10,10 90,20 80,90 20,80"
                 ]
               }}
               transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
             />
             <motion.polygon
               fill="currentColor"
               opacity="0.1"
               points="0,0 40,20 60,60 10,50"
               animate={{
                 points: [
                   "0,0 40,20 60,60 10,50",
                   "10,10 50,10 70,50 20,60",
                   "0,0 40,20 60,60 10,50"
                 ]
               }}
               transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
             />
             <motion.polygon
               fill="none"
               stroke="currentColor"
               strokeWidth="0.2"
               points="50,0 100,50 50,100 0,50"
               animate={{
                 points: [
                   "50,0 100,50 50,100 0,50",
                   "60,10 90,60 40,90 10,40",
                   "50,0 100,50 50,100 0,50"
                 ]
               }}
               transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
             />
          </motion.svg>
        </div>
        
        <div className="flex-1 overflow-auto p-4 sm:p-8 relative z-10 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              {activePage === 'search' && <SearchPage />}
              {activePage === 'kol' && <KOLManager />}
              {activePage === 'task' && <TaskMonitor />}
              {activePage === 'clip' && <ClipLibrary />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

