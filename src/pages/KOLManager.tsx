import { useState } from 'react';
import { useAppStore, KOL } from '../store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const WEEKDAY_OPTIONS = [
  { label: '周日', value: '0' },
  { label: '周一', value: '1' },
  { label: '周二', value: '2' },
  { label: '周三', value: '3' },
  { label: '周四', value: '4' },
  { label: '周五', value: '5' },
  { label: '周六', value: '6' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  label: `${hour.toString().padStart(2, '0')}:00`,
  value: hour.toString(),
}));

function buildWeeklyCron(weekday: string, hour: string): string {
  return `0 ${hour} * * ${weekday}`;
}

function parseWeeklyCron(cronExpr?: string): { weekday: string; hour: string } {
  const defaultValues = { weekday: '1', hour: '3' };
  if (!cronExpr) return defaultValues;

  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return defaultValues;

  const hour = parts[1];
  const weekday = parts[4];
  if (!/^\d+$/.test(hour) || Number(hour) > 23) return defaultValues;
  if (!/^[0-6]$/.test(weekday)) return defaultValues;

  return { weekday, hour };
}

export default function KOLManager() {
  const { kols, updateKOL, addKOL, isLoading } = useAppStore();
  const [editingKol, setEditingKol] = useState<KOL | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addSchedule, setAddSchedule] = useState<{ weekday: string; hour: string }>({
    weekday: '1',
    hour: '3',
  });
  const [newKol, setNewKol] = useState<Partial<KOL>>({
    channel_url: '',
    platform: 'youtube',
    tags: [],
    fetch_policy: { cron: buildWeeklyCron('1', '3'), max_videos: 20 },
    active: 1
  });

  const handleSave = async () => {
    if (editingKol) {
      try {
        await updateKOL(editingKol.id, editingKol);
        setEditingKol(null);
      } catch (error) {
        console.error('Failed to update KOL:', error);
      }
    }
  };

  const handleAdd = async () => {
    try {
      await addKOL(newKol);
      setIsAddDialogOpen(false);
      setAddSchedule({ weekday: '1', hour: '3' });
      setNewKol({
        channel_url: '',
        platform: 'youtube',
        tags: [],
        fetch_policy: { cron: buildWeeklyCron('1', '3'), max_videos: 20 },
        active: 1
      });
    } catch (error) {
      console.error('Failed to add KOL:', error);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <Terminal className="w-6 h-6 text-amber-500" />
            TARGET ENTITIES
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">URL · CRON · REMARK</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display uppercase tracking-widest rounded-sm h-10 px-6 font-bold" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Entity
        </Button>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-sm overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
          <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-500 font-display uppercase tracking-widest text-xs">
            <tr>
              <th className="px-6 py-4 font-bold">Source URI</th>
              <th className="px-6 py-4 font-bold">Cron</th>
              <th className="px-6 py-4 font-bold">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 font-mono text-sm">
            <AnimatePresence>
              {kols.map((kol, idx) => (
                <motion.tr 
                  key={kol.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                  onClick={() => setEditingKol(kol)}
                >
                  <td className="px-6 py-4 text-zinc-500">{kol.channel_url}</td>
                  <td className="px-6 py-4 text-zinc-400">
                    {(() => {
                      const { weekday, hour } = parseWeeklyCron(kol.fetch_policy?.cron);
                      const weekdayLabel = WEEKDAY_OPTIONS.find(o => o.value === weekday)?.label || weekday;
                      return (
                        <span className="text-zinc-400">
                          {weekdayLabel} · {hour.toString().padStart(2, '0')}:00
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-zinc-400">{kol.tags?.[0] || '—'}</span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={!!editingKol} onOpenChange={(open) => !open && setEditingKol(null)}>
        <DialogContent className="sm:max-w-[480px] bg-zinc-950 border border-zinc-800 p-0 rounded-sm overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 bg-zinc-900/50">
            <DialogTitle className="font-display uppercase tracking-widest text-zinc-100 flex items-center gap-2 text-sm font-bold">
              <span className="w-2 h-2 bg-amber-500 rounded-sm" /> EDIT ENTITY
            </DialogTitle>
          </DialogHeader>
          {editingKol && (
            <div className="px-6 py-6 space-y-5 font-mono">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Source URI</label>
                <Input 
                  value={editingKol.channel_url} 
                  onChange={e => setEditingKol({...editingKol, channel_url: e.target.value})}
                  className="bg-zinc-900 border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10"
                />
              </div>
              {(() => {
                const { weekday, hour } = parseWeeklyCron(editingKol.fetch_policy?.cron);
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Weekday</label>
                      <select
                        value={weekday}
                        onChange={e => {
                          const nextWeekday = e.target.value;
                          setEditingKol({
                            ...editingKol,
                            fetch_policy: {
                              ...editingKol.fetch_policy,
                              cron: buildWeeklyCron(nextWeekday, hour),
                            },
                          });
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10 px-3"
                      >
                        {WEEKDAY_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Time (24h)</label>
                      <select
                        value={hour}
                        onChange={e => {
                          const nextHour = e.target.value;
                          setEditingKol({
                            ...editingKol,
                            fetch_policy: {
                              ...editingKol.fetch_policy,
                              cron: buildWeeklyCron(weekday, nextHour),
                            },
                          });
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10 px-3"
                      >
                        {HOUR_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Remark (Optional)</label>
                <Input 
                  value={editingKol.tags?.[0] || ''} 
                  onChange={e => setEditingKol({
                    ...editingKol, 
                    tags: e.target.value.trim() ? [e.target.value.trim()] : []
                  })}
                  className="bg-zinc-900 border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10"
                  placeholder="可选备注"
                />
              </div>
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex gap-2">
            <Button variant="outline" onClick={() => setEditingKol(null)} className="flex-1 rounded-sm border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white uppercase text-xs tracking-widest font-bold">ABORT</Button>
            <Button onClick={handleSave} className="flex-1 rounded-sm bg-amber-500 hover:bg-amber-400 text-zinc-950 uppercase text-xs tracking-widest font-bold">APPLY</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[480px] bg-zinc-950 border border-zinc-800 p-0 rounded-sm overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 bg-zinc-900/50">
            <DialogTitle className="font-display uppercase tracking-widest text-zinc-100 flex items-center gap-2 text-sm font-bold">
              <span className="w-2 h-2 bg-amber-500 rounded-sm" /> ADD NEW ENTITY
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-6 space-y-5 font-mono">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Source URI</label>
              <Input
                value={newKol.channel_url}
                onChange={e => setNewKol({ ...newKol, channel_url: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10"
                placeholder="youtube.com/@channel"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Weekday</label>
                <select
                  value={addSchedule.weekday}
                  onChange={e => {
                    const nextWeekday = e.target.value;
                    setAddSchedule(prev => ({ ...prev, weekday: nextWeekday }));
                    setNewKol({
                      ...newKol,
                      fetch_policy: {
                        ...newKol.fetch_policy,
                        cron: buildWeeklyCron(nextWeekday, addSchedule.hour),
                      },
                    });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10 px-3"
                >
                  {WEEKDAY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Time (24h)</label>
                <select
                  value={addSchedule.hour}
                  onChange={e => {
                    const nextHour = e.target.value;
                    setAddSchedule(prev => ({ ...prev, hour: nextHour }));
                    setNewKol({
                      ...newKol,
                      fetch_policy: {
                        ...newKol.fetch_policy,
                        cron: buildWeeklyCron(addSchedule.weekday, nextHour),
                      },
                    });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10 px-3"
                >
                  {HOUR_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Remark (Optional)</label>
              <Input
                value={newKol.tags?.[0] || ''}
                onChange={e => setNewKol({
                  ...newKol,
                  tags: e.target.value.trim() ? [e.target.value.trim()] : []
                })}
                className="bg-zinc-900 border-zinc-800 rounded-sm focus-visible:ring-1 focus-visible:ring-amber-500 text-sm h-10"
                placeholder="可选备注"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 rounded-sm border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white uppercase text-xs tracking-widest font-bold">ABORT</Button>
            <Button onClick={handleAdd} className="flex-1 rounded-sm bg-amber-500 hover:bg-amber-400 text-zinc-950 uppercase text-xs tracking-widest font-bold" disabled={isLoading}>CREATE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
