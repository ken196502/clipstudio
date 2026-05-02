import { useState, useEffect } from 'react';
import { useAppStore, Clip } from '../store';
import { Button } from '@/components/ui/button';
import { Radar, MoveRight, Layers, Clapperboard, Trash2, ArrowRight, Download, Loader2 } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'motion/react';

interface CombineTask {
  taskId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
  currentClip?: number;
  totalClips?: number;
}

export default function CombinePage() {
  const { clips } = useAppStore();
  const [timeline, setTimeline] = useState<Clip[]>(clips.slice(0, 5));
  const [combineTask, setCombineTask] = useState<CombineTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const removeClip = (id: number) => {
    setTimeline(t => t.filter(c => c.id !== id));
  };

  const handleCombine = async () => {
    if (timeline.length === 0) {
      alert('Please add clips to the timeline first');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipIds: timeline.map(c => c.id),
          outputFormat: 'mp4',
          resolution: '1080p'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start combine task');
      }

      const data = await response.json();
      setCombineTask(data);
      setIsPolling(true);
    } catch (error) {
      console.error('Error starting combine task:', error);
      alert('Failed to start combine task. Please try again.');
    }
  };

  // Poll for task status
  useEffect(() => {
    if (!isPolling || !combineTask) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/combine/${combineTask.taskId}`);
        if (!response.ok) return;

        const data = await response.json();
        setCombineTask(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false);
        }
      } catch (error) {
        console.error('Error polling combine task:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isPolling, combineTask]);

  const handleDownload = () => {
    if (combineTask?.downloadUrl) {
      window.open(`http://localhost:3001${combineTask.downloadUrl}`, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto py-4">
      <div className="flex-none mb-8">
        <h1 className="text-3xl font-display font-bold tracking-tight text-white uppercase flex items-center gap-3">
          <Layers className="w-8 h-8 text-amber-500" />
          ASSET COMBINER / TIMELINE
        </h1>
        <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mt-2">
          Drag and drop to reorder clips. Extract as a new composite video.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0 bg-zinc-950/50 border border-zinc-800 rounded-sm relative overflow-hidden backdrop-blur-sm">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none opacity-50" />
        
        {/* Playhead marker indicator fixed in center */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-0 pointer-events-none" />

        <div className="w-full overflow-x-auto overflow-y-hidden px-[50vw] pb-8 pt-4 custom-scrollbar scroll-smooth flex items-center relative z-10">
          <Reorder.Group 
            axis="x" 
            values={timeline} 
            onReorder={setTimeline} 
            className="flex gap-4 items-center h-[280px]"
          >
            <AnimatePresence>
              {timeline.map((clip) => (
                <Reorder.Item 
                  key={clip.id} 
                  value={clip}
                  className="shrink-0 w-64 h-[240px] cursor-grab active:cursor-grabbing relative group hover:scale-[1.03] transition-transform hover-sweep"
                >
                  <div className="w-full h-full bg-zinc-900 border border-zinc-700/80 rounded-sm overflow-hidden flex flex-col group-hover:border-amber-500/80 transition-colors shadow-2xl relative">
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-transparent group-hover:border-amber-500 transition-colors z-10 m-1" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-transparent group-hover:border-amber-500 transition-colors z-10 m-1" />
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeClip(clip.id); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 text-zinc-400 hover:text-white z-20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="h-32 bg-black relative shrink-0">
                      <img src={clip.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 mix-blend-luminosity hover:mix-blend-normal transition-all" />
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 font-mono text-[10px] tracking-widest text-amber-500 font-bold">
                        {Math.floor((clip.endSec - clip.startSec) / 60)}m {Math.floor((clip.endSec - clip.startSec) % 60)}s
                      </div>
                    </div>
                    
                    <div className="p-3 flex-1 flex flex-col font-sans">
                      <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                        SRC: {clip.kolName}
                      </div>
                      <h3 className="text-xs font-display font-bold text-zinc-200 line-clamp-2 leading-tight uppercase group-hover:text-amber-400 transition-colors">
                        {clip.title}
                      </h3>
                      
                      <div className="mt-auto flex items-center gap-2">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500/50 w-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </div>
      </div>

    <div className="flex-none mt-8 flex justify-center pb-8">
        {combineTask ? (
          <div className="w-full max-w-2xl">
            {combineTask.status === 'processing' && (
              <div className="bg-zinc-900/80 border border-zinc-700 rounded-sm p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    <span className="text-zinc-300 font-mono text-sm uppercase tracking-widest">
                      Processing Clips
                    </span>
                  </div>
                  <span className="text-amber-500 font-mono text-sm">
                    {combineTask.currentClip}/{combineTask.totalClips}
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${combineTask.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="mt-2 text-right text-zinc-500 font-mono text-xs">
                  {combineTask.progress}%
                </div>
              </div>
            )}

            {combineTask.status === 'completed' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/80 border border-amber-500/50 rounded-sm p-6 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-amber-500 font-display font-bold text-lg uppercase tracking-widest mb-1">
                      Video Ready
                    </div>
                    <div className="text-zinc-500 font-mono text-xs">
                      Your combined video has been generated successfully
                    </div>
                  </div>
                  <Button
                    onClick={handleDownload}
                    size="lg"
                    className="h-12 px-8 bg-amber-500 hover:bg-amber-400 text-black font-display uppercase tracking-widest font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Video
                  </Button>
                </div>
              </motion.div>
            )}

            {combineTask.status === 'failed' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/80 border border-rose-500/50 rounded-sm p-6 backdrop-blur-sm"
              >
                <div className="text-rose-500 font-display font-bold text-lg uppercase tracking-widest mb-2">
                  Processing Failed
                </div>
                <div className="text-zinc-400 font-mono text-sm mb-4">
                  {combineTask.error || 'An error occurred while processing your video'}
                </div>
                <Button
                  onClick={() => setCombineTask(null)}
                  variant="outline"
                  className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                >
                  Try Again
                </Button>
              </motion.div>
            )}
          </div>
        ) : (
          <Button
            onClick={handleCombine}
            disabled={timeline.length === 0}
            size="lg"
            className="h-16 px-12 bg-amber-500 hover:bg-amber-400 text-black font-display uppercase tracking-[0.2em] font-black text-lg transition-all duration-300 shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] hover:scale-105 group overflow-hidden relative rounded-sm hover-fx hover-sweep disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="absolute inset-0 shimmer pointer-events-none" />
            <Clapperboard className="w-6 h-6 mr-3 group-hover-wiggle relative z-10" />
            <span className="relative z-10">COMBINE AS NEW VIDEO</span>
            <ArrowRight className="w-6 h-6 ml-4 opacity-0 -mr-6 group-hover:opacity-100 group-hover:mr-0 transition-all duration-300 relative z-10" />
          </Button>
        )}
      </div>
    </div>
  );
}
