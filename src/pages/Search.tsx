import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Radar, Database, Zap, X, Cpu, GitMerge, Clapperboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'motion/react';

const COMBO_STEPS = [
  { text: 'ANALYZING SEMANTIC VECTORS...', icon: Cpu },
  { text: 'ALIGNING TIMELINE FRAGMENTS...', icon: GitMerge },
  { text: 'SYNTHESIZING COMPOSITION...', icon: Clapperboard },
];

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayedText(text.slice(0, index + 1));
        index++;
        if (index >= text.length) {
          clearInterval(interval);
        }
      }, 40);
      return () => clearInterval(interval);
    }, 400);

    return () => clearTimeout(timer);
  }, [text]);

  return (
    <span className="border-r-[3px] border-amber-500 pr-1 animate-pulse">
      {displayedText}
    </span>
  );
}

export default function SearchPage() {
  const { clips, setActivePage, searchClips, luckyCombo } = useAppStore();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [comboStep, setComboStep] = useState(-1);
  const [searchResults, setSearchResults] = useState<ReturnType<typeof useAppStore.getState>['clips']>([]);

  useEffect(() => {
    if (comboStep >= 0 && comboStep < COMBO_STEPS.length) {
      const timer = setTimeout(() => {
        setComboStep(s => s + 1);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (comboStep === COMBO_STEPS.length) {
      setActivePage('combine');
      setComboStep(-1);
    }
  }, [comboStep, setActivePage]);

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

  const handleLuckyCombo = async () => {
    setComboStep(0);
    try {
      const selectedClips = await luckyCombo(query || 'AI technology');
      // Store selected clips for Combine page
      // In a real implementation, we'd save this to the store
      console.log('Selected clips:', selectedClips);
    } catch (error) {
      console.error('Lucky combo failed:', error);
      setComboStep(-1);
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

        <motion.div layout className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          <Button
            type="button"
            onClick={handleLuckyCombo}
            variant="outline"
            className="h-9 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 px-6 rounded-sm uppercase tracking-widest text-xs font-bold font-display group transition-all duration-300 hover-fx hover-sweep hover:scale-105"
          >
            <Zap className="w-4 h-4 mr-2 group-hover-wiggle" />
            LUCKY COMBO
          </Button>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {comboStep >= 0 && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90"
          >
            {/* Background grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.05)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
            
            <Button 
              variant="ghost" 
              className="absolute top-8 right-8 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-sm"
              onClick={() => setComboStep(-1)}
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="relative w-full max-w-2xl h-80 flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                {comboStep < COMBO_STEPS.length && (
                  <motion.div
                    key={comboStep}
                    initial={{ opacity: 0, x: 200, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -200, scale: 0.9 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center gap-8"
                  >
                    {/* Rotating Icon */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="relative z-10"
                      >
                        {(() => {
                          const Icon = COMBO_STEPS[comboStep].icon;
                          return <Icon className="w-24 h-24 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" strokeWidth={1.5} />;
                        })()}
                      </motion.div>
                    </div>

                    {/* Typewriter text */}
                    <div className="h-8 font-mono text-xl md:text-2xl text-amber-500 font-bold uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] flex items-center justify-center">
                      <TypewriterText text={COMBO_STEPS[comboStep].text} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                          <span>SRC: {clip.kolName} // CAT: {clip.topicCategory}</span>
                          <span>{clip.createdAt}</span>
                        </div>
                        
                        <h3 className="text-lg font-display font-bold text-zinc-100 leading-tight mb-2 group-hover:text-cyan-400 transition-colors uppercase">
                          {clip.title}
                        </h3>
                        
                        <p className="text-xs text-zinc-400 line-clamp-2">
                          {clip.summary}
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
