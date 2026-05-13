import { useState, useMemo, useCallback, useEffect } from 'react';
import React from 'react';
import { useAppStore, Clip } from '../store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, Smartphone, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function youtubeEmbedSrc(clip: Clip): string {
  const start = Math.max(0, Math.floor(clip.startSec));
  const end = Math.max(start + 1, Math.ceil(clip.endSec));
  return `https://www.youtube.com/embed/${clip.video_id}?start=${start}&end=${end}&autoplay=1&rel=0`;
}

interface DownloadState {
  status: 'idle' | 'rendering' | 'ready' | 'downloading' | 'error';
  progress?: number;
  error?: string;
  outputPath?: string;
}

export default function ClipLibrary() {
  const { clips, fetchClips } = useAppStore();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);
  const [downloadStates, setDownloadStates] = useState<Record<number, DownloadState>>({});

  useEffect(() => {
    fetchClips().catch((error) => {
      console.error('Failed to refresh clips on library open:', error);
    });
  }, [fetchClips]);

  const openPreview = useCallback((clip: Clip) => {
    setSelectedClip(null);
    setPreviewClip(clip);
  }, []);

  const [selectedKol, setSelectedKol] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const kolOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        clips
          .map((clip) => clip.kolName)
          .filter((name) => typeof name === 'string' && name.trim().length > 0)
      )
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return values;
  }, [clips]);


  const filteredClips = useMemo(() => {
    let result = clips;

    if (selectedKol !== 'all') {
      result = result.filter(c => c.kolName === selectedKol);
    }

    if (sortBy === 'newest') {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      result = [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return result;
  }, [clips, selectedKol, sortBy]);

  const formatDuration = (start: number, end: number) => {
    const s = Math.floor(start / 60);
    const sRem = start % 60;
    const e = Math.floor(end / 60);
    const eRem = end % 60;
    return `${s}m${sRem}s - ${e}m${eRem}s`;
  };

  const handleDownloadVertical = useCallback(async (clip: Clip, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const clipId = clip.id;

    setDownloadStates(prev => ({
      ...prev,
      [clipId]: { status: 'rendering', progress: 0 }
    }));

    try {
      // Start vertical render job
      const renderRes = await fetch('/api/clips/vertical-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId }),
      });

      if (!renderRes.ok) {
        const errData = await renderRes.json();
        throw new Error(errData.error || 'Failed to start render');
      }

      const renderData = await renderRes.json();

      // If already completed (cached), go straight to ready
      if (renderData.status === 'completed') {
        setDownloadStates(prev => ({
          ...prev,
          [clipId]: { status: 'ready', outputPath: renderData.outputPath }
        }));
        return;
      }

      const jobId = renderData.jobId;
      if (!jobId || jobId === 0) {
        setDownloadStates(prev => ({
          ...prev,
          [clipId]: { status: 'error', error: 'Invalid job ID returned' }
        }));
        return;
      }

      // Poll for completion
      let pollAttempts = 0;
      const maxPollAttempts = 150; // 5 minutes max (150 * 2s)
      const pollInterval = setInterval(async () => {
        try {
          pollAttempts++;
          if (pollAttempts > maxPollAttempts) {
            clearInterval(pollInterval);
            setDownloadStates(prev => ({
              ...prev,
              [clipId]: { status: 'error', error: 'Render timed out' }
            }));
            return;
          }
          const statusRes = await fetch(`/api/clips/vertical-render/${jobId}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            setDownloadStates(prev => ({
              ...prev,
              [clipId]: { status: 'ready', outputPath: statusData.outputPath }
            }));
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setDownloadStates(prev => ({
              ...prev,
              [clipId]: { status: 'error', error: statusData.error || 'Render failed' }
            }));
          } else {
            setDownloadStates(prev => ({
              ...prev,
              [clipId]: { status: 'rendering', progress: statusData.progress || 0 }
            }));
          }
        } catch {
          // Continue polling on network errors
        }
      }, 2000);
    } catch (error: any) {
      setDownloadStates(prev => ({
        ...prev,
        [clipId]: { status: 'error', error: error.message || 'Failed to start render' }
      }));
    }
  }, []);

  const handleDownloadFile = useCallback((clip: Clip) => {
    const state = downloadStates[clip.id];
    if (state?.status === 'ready' && state.outputPath) {
      const filename = state.outputPath.split('/').pop();
      window.open(`/api/clips/vertical-download/${filename}`, '_blank');
      setDownloadStates(prev => {
        const next = { ...prev };
        next[clip.id] = { status: 'idle' };
        return next;
      });
    }
  }, [downloadStates]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-800 pb-4 gap-4 shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-amber-500" />
            VERTICAL CLIPS
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">竖屏剪辑素材 · 标题字幕包裹 · 一键下载</p>
        </div>
        
        <div className="flex items-center gap-2 font-mono text-xs">
          <Select value={selectedKol} onValueChange={setSelectedKol}>
            <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-800 rounded-sm uppercase tracking-widest focus:ring-amber-500 font-bold text-[10px]">
              <SelectValue placeholder="SOURCE KOL" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800 rounded-sm font-mono uppercase text-[10px] font-bold tracking-widest">
              <SelectItem value="all">ALL ENTITIES</SelectItem>
              {kolOptions.map((kol) => (
                <SelectItem key={kol} value={kol}>
                  {kol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
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

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          <AnimatePresence>
            {filteredClips.map((clip, idx) => {
              const dlState = downloadStates[clip.id] || { status: 'idle' };
              return (
                <motion.div
                  key={clip.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                  className="group flex flex-col bg-zinc-900/30 border border-zinc-800 hover:border-amber-500/50 rounded-sm overflow-hidden transition-all duration-300 relative hover:-translate-y-1 hover:shadow-xl hover-sweep cursor-pointer"
                  onClick={() => setSelectedClip(clip)}
                >
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-transparent group-hover:border-amber-500 transition-colors z-10 m-0.5" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-transparent group-hover:border-amber-500 transition-colors z-10 m-0.5" />

                  {/* Vertical (9:16) card layout */}
                  <div className="relative aspect-[9/16] bg-zinc-900 overflow-hidden">
                    <img
                      src={clip.verticalCover || clip.thumbnail}
                      alt={clip.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 border-[0.5px] border-white/5 pointer-events-none mix-blend-overlay" />

                    {/* Dark gradient overlays for title and subtitle */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />

                    {/* Top section: KOL name tag */}
                    <div className="absolute top-3 left-3 right-3">
                      <span className="inline-block px-2 py-1 bg-amber-500 text-zinc-950 text-[9px] font-mono font-bold tracking-widest uppercase rounded-sm">
                        {clip.kolName}
                      </span>
                    </div>

                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Button
                        type="button"
                        size="icon"
                        className="rounded-full w-14 h-14 bg-white/20 backdrop-blur-md hover:bg-amber-500 text-white hover:text-zinc-950 scale-90 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(245,158,11,0.5)] group/play"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(clip);
                        }}
                      >
                        <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                      </Button>
                    </div>

                    {/* Bottom section: Title + subtitle + download */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                      <h3 className="font-display font-bold text-white text-sm leading-tight line-clamp-3 drop-shadow-lg">
                        {clip.title}
                      </h3>
                      <p className="text-[11px] text-zinc-300/90 line-clamp-2 leading-relaxed drop-shadow-md">
                        {clip.videoTitle}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="px-1.5 py-0.5 bg-black/60 border border-zinc-700 text-[9px] font-mono text-zinc-300 tracking-widest font-bold rounded-sm">
                          {Math.floor((clip.endSec - clip.startSec) / 60)}m{Math.floor((clip.endSec - clip.startSec) % 60)}s
                        </span>
                        
                        {/* Download button with states */}
                        {dlState.status === 'idle' && (
                          <Button variant="ghost" size="icon" onClick={(e) => handleDownloadVertical(clip, e)} className="h-7 w-7 text-white/70 hover:text-amber-400 hover:bg-transparent rounded-none transition-transform hover:scale-110">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        {dlState.status === 'rendering' && (
                          <div className="h-7 w-7 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                          </div>
                        )}
                        {dlState.status === 'ready' && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownloadFile(clip); }} className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-transparent rounded-none transition-transform hover:scale-110">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        {dlState.status === 'error' && (
                          <Button variant="ghost" size="icon" onClick={(e) => handleDownloadVertical(clip, e)} className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-transparent rounded-none transition-transform hover:scale-110" title={dlState.error}>
                            <AlertCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedClip} onOpenChange={(open) => !open && setSelectedClip(null)}>
        <DialogContent className="max-w-[500px] p-0 bg-zinc-950 border border-zinc-800 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden gap-0">
          {selectedClip && (
            <div className="flex flex-col max-h-[85vh]">
              {/* Vertical preview */}
              <div className="relative aspect-[9/16] max-h-[60vh] bg-black overflow-hidden">
                <img
                  src={selectedClip.verticalCover || selectedClip.thumbnail}
                  alt={selectedClip.title}
                  className="w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/90" />

                {/* Top: KOL tag */}
                <div className="absolute top-4 left-4 right-4">
                  <span className="inline-block px-2 py-1 bg-amber-500 text-zinc-950 text-[10px] font-mono font-bold tracking-widest uppercase rounded-sm">
                    {selectedClip.kolName}
                  </span>
                </div>

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md hover:bg-amber-500 text-white hover:text-zinc-950 flex items-center justify-center transition-transform hover:scale-110 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                    onClick={() => openPreview(selectedClip)}
                  >
                    <Play className="w-8 h-8 ml-1" fill="currentColor" />
                  </button>
                </div>

                {/* Bottom: Title */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                  <h2 className="text-lg font-display font-bold text-white leading-tight drop-shadow-lg">
                    {selectedClip.title}
                  </h2>
                  <p className="text-xs text-zinc-300/90 line-clamp-2 leading-relaxed drop-shadow-md">
                    {selectedClip.videoTitle}
                  </p>
                </div>
              </div>

              {/* Info bar */}
              <div className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-3">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  <span>SRC: {selectedClip.kolName}</span>
                  <span>{Math.floor((selectedClip.endSec - selectedClip.startSec) / 60)}m{Math.floor((selectedClip.endSec - selectedClip.startSec) % 60)}s</span>
                </div>

                {/* Download vertical video button */}
                <div className="pt-2">
                  {(() => {
                    const dlState = downloadStates[selectedClip.id] || { status: 'idle' };
                    if (dlState.status === 'idle') {
                      return (
                        <Button
                          onClick={() => handleDownloadVertical(selectedClip)}
                          className="w-full rounded-sm bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display uppercase tracking-widest text-[10px] font-bold h-10 shadow-[0_0_15px_rgba(245,158,11,0.2)] group hover-fx hover-sweep hover:scale-105 transition-transform"
                        >
                          <Download className="w-3.5 h-3.5 mr-2 group-hover-wiggle" />
                          下载竖屏视频（带标题字幕）
                        </Button>
                      );
                    }
                    if (dlState.status === 'rendering') {
                      return (
                        <Button disabled className="w-full rounded-sm bg-zinc-800 text-amber-400 font-display uppercase tracking-widest text-[10px] font-bold h-10">
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          渲染中 {dlState.progress ? `${dlState.progress}%` : '...'}
                        </Button>
                      );
                    }
                    if (dlState.status === 'ready') {
                      return (
                        <Button
                          onClick={() => handleDownloadFile(selectedClip)}
                          className="w-full rounded-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display uppercase tracking-widest text-[10px] font-bold h-10 shadow-[0_0_15px_rgba(16,185,129,0.2)] group hover:scale-105 transition-transform"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                          下载已就绪 · 点击下载
                        </Button>
                      );
                    }
                    if (dlState.status === 'error') {
                      return (
                        <Button
                          onClick={() => handleDownloadVertical(selectedClip)}
                          className="w-full rounded-sm bg-rose-500/20 border border-rose-500/50 text-rose-400 hover:bg-rose-500/30 font-display uppercase tracking-widest text-[10px] font-bold h-10"
                        >
                          <AlertCircle className="w-3.5 h-3.5 mr-2" />
                          渲染失败 · 重试
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* YouTube preview dialog */}
      <Dialog open={!!previewClip} onOpenChange={(open) => !open && setPreviewClip(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 bg-zinc-950 border border-zinc-800 overflow-hidden">
          {previewClip && (
            <>
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-1">
                <span className="text-sm text-zinc-100 line-clamp-2 font-medium leading-snug">{previewClip.title}</span>
                <span className="text-[10px] font-mono text-zinc-500 tracking-wide truncate">
                  {previewClip.videoTitle} · {formatDuration(previewClip.startSec, previewClip.endSec)}
                </span>
              </div>
              <div className="aspect-video w-full bg-black">
                <iframe
                  title="Clip preview"
                  className="h-full w-full"
                  src={youtubeEmbedSrc(previewClip)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
