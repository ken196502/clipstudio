import { useEffect } from 'react';
import { useAppStore } from '../store';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TaskMonitor() {
  const { jobs, fetchJobs } = useAppStore();

  // Poll for job updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs();
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchJobs]);

  const runningJobs = jobs.filter(j => j.status === 'running');
  const historyJobs = jobs.filter(j => j.status !== 'running');

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'running': return <span className="text-cyan-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> EXECUTING</span>;
      case 'success': return <span className="text-zinc-500 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> COMPILED</span>;
      case 'failed': return <span className="text-rose-500 flex items-center gap-2"><XCircle className="w-3 h-3" /> FAILED</span>;
      default: return null;
    }
  };

  const getStageLabel = (stage: string) => {
    const map: Record<string, string> = {
      crawl: 'AWAITING_METADATA',
      process: 'SEGMENT_STREAM',
      clip: 'EXTRACT_HIGHLIGHTS',
      index: 'VECTOR_INDEXING'
    };
    return map[stage] || stage.toUpperCase();
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-500" />
            PROCESS MONITOR
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Track scheduler jobs and pipeline status</p>
        </div>
        <Button variant="outline" onClick={() => fetchJobs()} className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white text-zinc-300 font-display uppercase tracking-widest rounded-sm h-10 px-6 text-xs font-bold transition-all">
          <RefreshCw className="w-4 h-4 mr-2" />
          SYNC LOGS
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1.5 h-6 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <h2 className="text-sm font-display font-bold tracking-widest text-zinc-100 uppercase">Active Threads ({runningJobs.length})</h2>
        </div>
        
        {runningJobs.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/20 border border-zinc-800/50 border-dashed text-zinc-600 font-mono text-xs uppercase tracking-widest">
            IDLE // NO ACTIVE THREADS
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence>
              {runningJobs.map((job, idx) => (
                <motion.div 
                  key={job.id} 
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: 'blur(5px)' }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="p-4 rounded-sm border border-cyan-900/50 bg-cyan-950/20 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
                  <div className="flex justify-between items-center mb-4 relative z-10 font-mono">
                    <div className="flex items-center gap-4 text-sm">
                       <span className="text-cyan-400 font-bold uppercase drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">
                         [{job.kolName}]
                       </span>
                       <span className="text-zinc-300">{job.videoTitle}</span>
                       <span className="text-cyan-500/50">|</span>
                       <span className="text-zinc-400 text-xs tracking-widest text-[10px]">STAGE: {getStageLabel(job.stage)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 rounded-sm text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 uppercase text-xs tracking-widest font-bold">TERMINATE</Button>
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="h-1.5 flex-1 bg-zinc-900 overflow-hidden relative border border-zinc-800">
                      <motion.div 
                        className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" 
                        initial={{ width: 0 }}
                        animate={{ width: `${job.progress || 0}%` }} 
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs font-mono text-cyan-400 font-bold w-12 text-right">
                      {job.progress}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1.5 h-6 bg-zinc-700" />
          <h2 className="text-sm font-display font-bold tracking-widest text-zinc-400 uppercase">Execution Log</h2>
        </div>
        
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-sm overflow-hidden backdrop-blur-sm">
          <table className="w-full text-left">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-500 font-display uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-5 py-3 font-semibold">Timestamp</th>
                <th className="px-5 py-3 font-semibold">Entity</th>
                <th className="px-5 py-3 font-semibold">Asset Target</th>
                <th className="px-5 py-3 font-semibold">Operation Stage</th>
                <th className="px-5 py-3 font-semibold">Termination Status</th>
                <th className="px-5 py-3 text-right font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 font-mono text-[13px]">
              <AnimatePresence>
                {historyJobs.map((job, idx) => (
                  <motion.tr 
                    key={job.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-zinc-800/30 transition-colors text-zinc-400"
                  >
                    <td className="px-5 py-3 text-zinc-600">{job.time}</td>
                    <td className="px-5 py-3 font-bold text-zinc-300">{job.kolName}</td>
                    <td className="px-5 py-3 text-zinc-400 truncate max-w-[200px]">{job.videoTitle}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-sm bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] uppercase tracking-widest font-bold">
                        {job.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-[11px] tracking-widest">
                      {getStatusDisplay(job.status)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-zinc-500">{job.duration || '—'}</span>
                      {job.status === 'failed' && (
                        <button className="ml-3 text-cyan-500 hover:text-cyan-400 font-bold uppercase text-[10px] tracking-widest">RETRY</button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
