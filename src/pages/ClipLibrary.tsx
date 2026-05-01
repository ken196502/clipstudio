import { useState } from 'react';
import { useAppStore, Clip } from '../store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, Copy, Film, Shapes } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ClipLibrary() {
  const { clips } = useAppStore();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);

  const formatDuration = (start: number, end: number) => {
    const s = Math.floor(start / 60);
    const sRem = start % 60;
    const e = Math.floor(end / 60);
    const eRem = end % 60;
    return `${s}m${sRem}s - ${e}m${eRem}s`;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-800 pb-4 gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <Film className="w-6 h-6 text-amber-500" />
            ASSET LIBRARY
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Indexed and processed video fragments</p>
        </div>
        
        <div className="flex items-center gap-2 font-mono text-xs">
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-800 rounded-sm uppercase tracking-widest focus:ring-amber-500 font-bold text-[10px]">
              <SelectValue placeholder="SOURCE KOL" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 rounded-sm font-mono uppercase text-[10px] font-bold tracking-widest">
              <SelectItem value="all">ALL ENTITIES</SelectItem>
              <SelectItem value="李自然">LIZIRAN</SelectItem>
              <SelectItem value="硅谷徐">GUIGUXU</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-800 rounded-sm uppercase tracking-widest focus:ring-amber-500 font-bold text-[10px]">
              <SelectValue placeholder="CATEGORY" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 rounded-sm font-mono uppercase text-[10px] font-bold tracking-widest">
              <SelectItem value="all">ALL CATS</SelectItem>
              <SelectItem value="观点">OPINION</SelectItem>
              <SelectItem value="分析">ANALYSIS</SelectItem>
              <SelectItem value="教程">TUTORIAL</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="newest">
            <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-800 rounded-sm uppercase tracking-widest focus:ring-amber-500 font-bold text-[10px]">
              <SelectValue placeholder="SORT" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 rounded-sm font-mono uppercase text-[10px] font-bold tracking-widest">
              <SelectItem value="newest">LATEST_DESC</SelectItem>
              <SelectItem value="oldest">LATEST_ASC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {clips.map((clip, idx) => (
            <motion.div 
              key={clip.id} 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className="group flex flex-col bg-zinc-900/30 border border-zinc-800 hover:border-amber-500/50 rounded-sm overflow-hidden transition-all duration-300 relative hover:-translate-y-1 hover:shadow-xl hover-sweep"
            >
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-transparent group-hover:border-amber-500 transition-colors z-10 m-0.5" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-transparent group-hover:border-amber-500 transition-colors z-10 m-0.5" />

              <div className="relative aspect-[16/9] bg-zinc-900 overflow-hidden">
                <img src={clip.thumbnail} alt={clip.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100 mix-blend-luminosity hover:mix-blend-normal" />
                <div className="absolute inset-0 border-[0.5px] border-white/5 pointer-events-none mix-blend-overlay" />
                
                <div className="absolute inset-0 bg-zinc-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                  <Button size="icon" className="rounded-sm w-12 h-12 bg-amber-500 hover:bg-amber-400 text-zinc-950 scale-90 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(245,158,11,0.5)] group/play">
                    <Play className="w-5 h-5 ml-0.5 group-hover/play:animate-[wiggle_0.5s_ease-in-out]" fill="currentColor" />
                  </Button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-zinc-950 to-transparent">
                   <div className="flex justify-between items-end">
                      <span className="px-1.5 py-0.5 bg-black/80 border border-zinc-800 text-[10px] font-mono text-zinc-300 tracking-widest font-bold">
                        {Math.floor((clip.endSec - clip.startSec) / 60)}m {Math.floor((clip.endSec - clip.startSec) % 60)}s
                      </span>
                   </div>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col pt-3">
                <div className="flex items-center justify-between mb-2">
                   <span className="text-[10px] font-mono font-bold text-amber-500 tracking-widest uppercase">{clip.topicCategory}</span>
                   <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">SRC: {clip.kolName}</span>
                </div>
                
                <h3 className="font-display font-bold text-zinc-100 leading-tight mb-2 line-clamp-2 uppercase">
                  {clip.title}
                </h3>
                
                <p className="text-xs text-zinc-500 line-clamp-2 mb-4 flex-1 font-sans">
                  {clip.summary}
                </p>
                
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
                  <div className="flex gap-1.5 overflow-hidden">
                    {clip.keywords.slice(0, 2).map(kw => (
                      <span key={kw} className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 border border-zinc-700/50 tracking-widest uppercase rounded-sm">
                        {kw}
                      </span>
                    ))}
                    {clip.keywords.length > 2 && <span className="text-[10px] font-mono text-zinc-600">...</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedClip(clip)} className="h-6 w-6 text-zinc-500 hover:text-amber-500 hover:bg-transparent rounded-none transition-transform hover:scale-110 group/btn">
                    <Download className="w-4 h-4 group-hover/btn:animate-[wiggle_0.5s_ease-in-out]" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={!!selectedClip} onOpenChange={(open) => !open && setSelectedClip(null)}>
        <DialogContent className="max-w-[900px] p-0 bg-zinc-950 border border-zinc-800 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden gap-0">
          {selectedClip && (
            <div className="flex flex-col md:flex-row h-[500px]">
              <div className="w-full md:w-[60%] bg-black relative group flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800">
                 <img src={selectedClip.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-20 transition-opacity mix-blend-luminosity" />
                 
                 <div className="absolute top-4 left-4 font-mono text-[10px] text-amber-500 flex flex-col gap-1 tracking-widest pointer-events-none font-bold">
                   <span>REC_ACT</span>
                   <span>F_RATE: 29.97</span>
                   <span>RES: 1080p</span>
                 </div>
                 
                 <button className="relative z-10 w-16 h-16 rounded-sm bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center transition-transform hover:scale-[1.15] active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.4)] group hover-sweep hover-fx">
                    <Play className="w-8 h-8 ml-1 group-hover-wiggle relative z-10" fill="currentColor" />
                 </button>
                 
                 <div className="absolute bottom-0 inset-x-0 h-10 bg-zinc-950/80 backdrop-blur-sm border-t border-zinc-800 flex items-center px-4 gap-3">
                    <Play className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-white" />
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-sm relative cursor-pointer group/bar">
                      <div className="absolute left-0 top-0 bottom-0 bg-amber-500 w-[30%] shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      <div className="absolute left-[30%] top-1/2 -translate-y-1/2 w-3 h-3 bg-white shadow-sm opacity-0 group-hover/bar:opacity-100 transition-opacity rounded-sm" />
                    </div>
                    <span className="font-mono text-[10px] tracking-widest font-bold text-zinc-400">{formatDuration(selectedClip.startSec, selectedClip.endSec)}</span>
                 </div>
              </div>

              <div className="w-full md:w-[40%] flex flex-col bg-zinc-900/50">
                <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2">
                   <Shapes className="w-4 h-4 text-amber-500" />
                   <h3 className="font-display font-bold tracking-widest uppercase text-xs text-zinc-300">Asset Details</h3>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto space-y-6 shrink-0 font-sans">
                  <div>
                    <div className="flex items-center gap-2 mb-2 font-mono text-[10px] tracking-widest uppercase text-zinc-500 font-bold">
                       <span className="text-amber-500">{selectedClip.topicCategory}</span>
                       <span>//</span>
                       <span>SRC: {selectedClip.kolName}</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-zinc-100 leading-tight mb-2 uppercase">
                      {selectedClip.title}
                    </h2>
                    <p className="text-[10px] text-amber-500/80 font-mono tracking-widest uppercase truncate border border-amber-500/20 bg-amber-500/5 px-2 py-1 rounded-sm w-max">
                      REF: {selectedClip.videoTitle}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-1">Generated Summary</h4>
                    <p className="text-sm leading-relaxed text-zinc-300 border-l-2 border-zinc-700 pl-3 py-1">
                      {selectedClip.summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-2">Semantic Keywords</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedClip.keywords.map(kw => (
                        <span key={kw} className="font-mono font-bold text-[10px] tracking-widest uppercase text-zinc-400 bg-zinc-800 px-2 py-0.5 border border-zinc-700/50 rounded-sm">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-950 grid grid-cols-2 gap-2 mt-auto">
                  <Button variant="outline" className="w-full rounded-sm border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 font-display uppercase tracking-widest text-[10px] font-bold h-10 group hover-fx hover-sweep">
                    <Copy className="w-3.5 h-3.5 mr-2 group-hover-wiggle" />
                    COPY REF
                  </Button>
                  <Button className="w-full rounded-sm bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display uppercase tracking-widest text-[10px] font-bold h-10 shadow-[0_0_15px_rgba(245,158,11,0.2)] group hover-fx hover-sweep hover:scale-105 transition-transform">
                    <Download className="w-3.5 h-3.5 mr-2 group-hover-wiggle relative z-10" />
                    <span className="relative z-10">EXTRACT</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
