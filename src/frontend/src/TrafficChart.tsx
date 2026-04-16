import { useEffect, useState } from 'react';
import { api } from './api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Activity, HardDrive, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export const TrafficChart = ({ lbId }: { lbId?: number }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lbPage, setLbPage] = useState(0);
  const [upPage, setUpPage] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchTraffic = async () => {
      setLoading(true);
      try {
        const res = await api.getTraffic(days, lbId);
        if (mounted) {
          setData(res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTraffic();
    const intv = setInterval(fetchTraffic, 60000); // refresh every minute automatically
    return () => {
      mounted = false;
      clearInterval(intv);
    };
  }, [days, lbId]);

  if (loading && !data) {
    return <div className="text-sm text-slate-500 animate-pulse">Loading traffic metrics...</div>;
  }

  if (!data) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    if (days <= 1) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days <= 7) {
      return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
    }
  };

  return (
    <div className={`chart-container ${lbId ? 'chart-container--flat' : ''}`}>
      {!lbId && (
        <div className="chart-header">
        <div>
          <h2 className="chart-title">
            <Activity className="icon-main" />
            Network Traffic Monitor
          </h2>
          <p className="chart-subtitle">Real-time aggregated bandwidth & requests</p>
        </div>
        <div className="chart-actions">
          <Filter className="icon-sub" size={16} />
          <select 
            value={days} 
            onChange={e => setDays(Number(e.target.value))}
            className="chart-select"
          >
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          {!lbId && (
            <button 
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse Analytics" : "Expand Analytics"}
              style={{ marginLeft: '8px' }}
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          )}
        </div>
      </div>
      )}

      {(lbId || isExpanded) && (
        <>
          <div className="chart-kpis">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper kpi-bg-indigo">
            <Activity className="kpi-icon kpi-color-indigo" />
          </div>
          <div>
            <div className="kpi-label">Total Requests</div>
            <div className="kpi-value">{data.totalRequests.toLocaleString()}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper kpi-bg-emerald">
            <HardDrive className="kpi-icon kpi-color-emerald" />
          </div>
          <div>
            <div className="kpi-label">Bandwidth (Bytes Sent)</div>
            <div className="kpi-value">{formatBytes(data.totalBytes)}</div>
          </div>
        </div>
      </div>

      <div className="chart-sections">
        {/* TIME SERIES */}
        <div className="chart-panel">
          <h3 className="panel-title">Requests Timeline</h3>
          <div className="recharts-wrapper-large">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tickFormatter={formatTime} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                <Tooltip 
                  labelFormatter={(lbl) => new Date(lbl).toLocaleString()} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-grid" style={{ gridTemplateColumns: '1fr' }}>
          {/* UPSTREAMS (Only show if viewing specifically an LB) */}
          {lbId && (
            <div className="chart-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="panel-title" style={{ margin: 0 }}>Traffic per Upstream</h3>
                {data.upstreams.length > 10 && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setUpPage(Math.max(0, upPage - 1))}
                      disabled={upPage === 0}
                      style={{ padding: '4px' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setUpPage(upPage + 1)}
                      disabled={(upPage + 1) * 10 >= data.upstreams.length}
                      style={{ padding: '4px' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="recharts-wrapper-small" style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.upstreams.slice(upPage * 10, (upPage + 1) * 10)} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e8e9" />
                    <XAxis dataKey="upstream" stroke="#626976" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#626976" fontSize={12} tickLine={false} axisLine={false} width={70} />
                    <Tooltip cursor={{ fill: '#f8f9fa' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e6e8e9', boxShadow: '0 4px 16px rgba(35, 46, 60, 0.08)' }} />
                    <Bar dataKey="requests" fill="#206bc4" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* LOAD BALANCERS (only show if viewing globally) */}
          {!lbId && (
            <div className="chart-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="panel-title" style={{ margin: 0 }}>Traffic per Load Balancer</h3>
                {data.loadBalancers.length > 10 && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setLbPage(Math.max(0, lbPage - 1))}
                      disabled={lbPage === 0}
                      style={{ padding: '4px' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setLbPage(lbPage + 1)}
                      disabled={(lbPage + 1) * 10 >= data.loadBalancers.length}
                      style={{ padding: '4px' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="recharts-wrapper-small" style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.loadBalancers.slice(lbPage * 10, (lbPage + 1) * 10)} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e8e9" />
                    <XAxis dataKey="lbName" stroke="#626976" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#626976" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatBytes} width={90} />
                    <Tooltip cursor={{ fill: '#f8f9fa' }} formatter={(val: number) => formatBytes(val)} labelFormatter={() => 'Load Balancer'} contentStyle={{ borderRadius: '8px', border: '1px solid #e6e8e9', boxShadow: '0 4px 16px rgba(35, 46, 60, 0.08)' }} />
                    <Bar dataKey="bytes" fill="#2fb344" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};
