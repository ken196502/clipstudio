import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Radar, Database, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';

export default function SearchPage() {
  const { clips, searchClips } = useAppStore();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<ReturnType<typeof useAppStore.getState>['clips']>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchClips(query);
      setSearchResults(results);
      setHasSearched(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const results = hasSearched ? searchResults : clips.filter(c => c.relevance);

  return (
    <div className={cn("max-w-4xl mx-auto h-full flex flex-col pt-8", !hasSearched && "justify-center px-4")}>
      <motion.div 
        layout
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn("flex-none pb-6", hasSearched ? "border-b border-zinc-800" : "")}
      >
        <motion.h1 layout className="text-3xl font-display font-bold tracking-tight text-white uppercase flex items-center justify-center gap-3 mb-8">
          <Radar className="w-8 h-8 text-cyan-400 animate-[spin_4s_linear_infinite]" />
          GLOBAL SEARCH PROTOCOL
        </motion.h1>
        
        <motion.form layout onSubmit={handleSearch} className="max-w-2xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-cyan-500/20 blur opacity-0 group-hover:opacity-100 transition duration-500 rounded-sm"></div>
          <div className="relative flex items-center bg-zinc-950 border border-zinc-700/80 focus-within:border-cyan-400 p-1.5 transition-colors shadow-2xl rounded-sm">
            <Search className="w-5 h-5 text-cyan-500/50 ml-3" />
            <Input 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ENTER SEMANTIC QUERY PARAMETERS..." 
              className="flex-1 border-0 shadow-none focus-visible:ring-0 text-cyan-400 placeholder:text-zinc-600 bg-transparent font-mono tracking-wider font-bold text-sm h-10"
            />
            <Button type="submit" disabled={isSearching} className="rounded-sm px-6 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 uppercase font-display tracking-widest font-bold text-xs h-10 shrink-0 overflow-hidden relative hover-fx hover-sweep group hover:scale-105 transition-transform">
              <AnimatePresence mode="wait">
                {isSearching ? (
                  <motion.div
                    key="searching"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center relative z-10"
                  >
                    <Zap className="w-4 h-4 mr-2 animate-pulse" /> PROCESSING
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center relative z-10"
                  >
                    <Radar className="w-4 h-4 mr-2 group-hover-wiggle" /> INITIATE
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </motion.form>

      </motion.div>

      <AnimatePresence>
        {hasSearched && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            className="flex-1 flex flex-col min-h-0 bg-zinc-900/40 border border-zinc-800 rounded-sm overflow-hidden backdrop-blur-sm relative"
          >
            {/* Scanning line effect */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.8)] z-20 animate-[scan_2s_ease-in-out_infinite] opacity-50 pointer-events-none" />
            
            <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 shrink-0">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-cyan-500" />
                QUERY RETURNED {results.length + 1} ASSETS
              </h2>
            </div>
            
            <ScrollArea className="flex-1 p-6 relative z-10 w-full">
              <div className="space-y-4 pr-4">
                {results.map((clip, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    key={clip.id} 
                    className="group relative bg-zinc-950/80 border border-zinc-800 p-4 hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-600 group-hover:border-cyan-500" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-600 group-hover:border-cyan-500" />
                    
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-zinc-900 overflow-hidden">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${clip.relevance}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 + 0.3, ease: 'easeOut' }}
                        className={cn(
                          "w-full absolute bottom-0 shadow-[0_0_10px_currentColor]",
                          idx === 0 ? "bg-cyan-400 text-cyan-400" : "bg-cyan-700 text-cyan-700"
                        )} 
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-5 ml-4">
                      <div className="w-full sm:w-48 aspect-[16/9] overflow-hidden shrink-0 relative bg-zinc-900 border border-zinc-800">
                         <img src={clip.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity mix-blend-luminosity hover:mix-blend-normal" />
                         <div className="absolute bottom-0 right-0 px-1.5 py-0.5 bg-cyan-500 text-[10px] text-zinc-950 font-bold font-mono tracking-widest">
                           {clip.relevance}% MATCH
                         </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center font-sans">
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] uppercase tracking-widest font-bold text-zinc-600">
                          <span>SRC: {clip.kolName}</span>
                          <span>{clip.createdAt}</span>
                        </div>
                        
                        <h3 className="text-lg font-display font-bold text-zinc-100 leading-tight mb-2 group-hover:text-cyan-400 transition-colors uppercase">
                          {clip.title}
                        </h3>
                        
                        <p className="text-xs text-zinc-400 line-clamp-2">
                          {clip.videoTitle}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: results.length * 0.1, duration: 0.4 }}
                  className="group relative bg-zinc-950/80 border border-zinc-800 p-4 hover:border-cyan-500/50 transition-colors"
                >
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-600 group-hover:border-cyan-500" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-600 group-hover:border-cyan-500" />
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-zinc-900 overflow-hidden">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: "65%" }}
                        transition={{ duration: 1, delay: results.length * 0.1 + 0.3, ease: 'easeOut' }}
                        className="w-full absolute bottom-0 bg-cyan-900 text-cyan-900 shadow-[0_0_10px_currentColor]" 
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-5 ml-4">
                      <div className="w-full sm:w-48 aspect-[16/9] overflow-hidden shrink-0 relative bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                         <span className="font-mono text-[10px] text-zinc-700 tracking-widest uppercase font-bold">No Visual Data</span>
                         <div className="absolute bottom-0 right-0 px-1.5 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 font-bold font-mono tracking-widest">
                           65% MATCH
                         </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center font-sans">
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] uppercase tracking-widest font-bold text-zinc-600">
                          <span>SRC: GUIGUXU // CAT: ANALYSIS</span>
                          <span>...</span>
                        </div>
                        <h3 className="text-lg font-display font-bold text-zinc-100 leading-tight mb-2 group-hover:text-cyan-400 transition-colors uppercase">
                          为什么 90% AI 工具会死掉
                        </h3>
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                          从商业模式角度分析 AI 工具产品的生存困境，指出缺乏核心壁垒和依赖底层模型的包装壳最终会被淘汰...
                        </p>
                      </div>
                    </div>
                </motion.div>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
