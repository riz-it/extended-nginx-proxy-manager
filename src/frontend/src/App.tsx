import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Settings, 
  Trash2, 
  Play, 
  Pause, 
  FileText, 
  Server, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Shield,
  Layers,
  LogOut,
  Copy,
  Database
} from 'lucide-react';
import './index.css';
import { api } from './api';
import type { LoadBalancer, Upstream, CreateLbPayload } from './types';

// ── Toast System ────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Upstream Editor Row ─────────────────────────────────────

interface UpstreamFormData {
  host: string;
  weight: number;
  maxFails: number;
  failTimeout: string;
  isBackup: boolean;
  isActive: boolean;
  protocol: string;
}

function UpstreamRow({
  index,
  data,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  data: UpstreamFormData;
  onChange: (index: number, data: UpstreamFormData) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="upstream-row">
      <div className="upstream-row-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={`upstream-dot ${data.isBackup ? 'backup' : 'primary'}`} />
          <span className="upstream-row-number">
             {data.isBackup ? 'Secondary / Backup Server' : `Primary Upstream Node ${index + 1}`}
          </span>
        </div>
        {canRemove && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onRemove(index)}
            title="Remove upstream"
            style={{ color: 'var(--danger)', width: 24, height: 24 }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 0.5fr) 2fr 0.5fr 0.5fr 0.8fr', gap: '1rem', alignItems: 'start' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Protocol</label>
          <select
            className="form-input"
            style={{ padding: '7px 8px' }}
            value={data.protocol}
            onChange={(e) => onChange(index, { ...data, protocol: e.target.value })}
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Host & Port</label>
          <input
            className="form-input"
            style={{ padding: '7px 8px' }}
            placeholder="10.0.0.1:3000"
            value={data.host}
            onChange={(e) => onChange(index, { ...data, host: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Weight</label>
          <input
            className="form-input"
            style={{ padding: '7px 8px' }}
            type="number"
            min={1}
            value={data.weight}
            onChange={(e) =>
              onChange(index, { ...data, weight: parseInt(e.target.value) || 1 })
            }
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fails</label>
          <input
            className="form-input"
            style={{ padding: '7px 8px' }}
            type="number"
            min={1}
            value={data.maxFails}
            onChange={(e) =>
              onChange(index, { ...data, maxFails: parseInt(e.target.value) || 1 })
            }
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Timeout</label>
          <input
            className="form-input"
            style={{ padding: '7px 8px' }}
            placeholder="10s"
            value={data.failTimeout}
            onChange={(e) =>
              onChange(index, { ...data, failTimeout: e.target.value })
            }
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f1f1' }}>
        <label className="form-check">
          <input
            type="checkbox"
            checked={data.isBackup}
            onChange={(e) =>
              onChange(index, { ...data, isBackup: e.target.checked })
            }
          />
          <Shield size={12} color={data.isBackup ? 'var(--warning)' : '#ccc'} />
          Secondary / Backup Server
        </label>
        <label className="form-check">
          <input
            type="checkbox"
            checked={data.isActive}
            onChange={(e) =>
              onChange(index, { ...data, isActive: e.target.checked })
            }
          />
          <CheckCircle2 size={12} color={data.isActive ? 'var(--success)' : '#ccc'} />
          Enabled for Distribution
        </label>
      </div>
    </div>
  );
}

// ── Create / Edit Modal ─────────────────────────────────────

function LbModal({
  isOpen,
  editLb,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  editLb: LoadBalancer | null;
  onClose: () => void;
  onSave: (data: CreateLbPayload) => void;
}) {
  const [name, setName] = useState('');
  const [listenPort, setListenPort] = useState(80);
  const [upstreams, setUpstreams] = useState<UpstreamFormData[]>([
    defaultUpstream(),
  ]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'upstreams'>('details');

  function defaultUpstream(): UpstreamFormData {
    return {
      host: '',
      weight: 1,
      maxFails: 3,
      failTimeout: '10s',
      isBackup: false,
      isActive: true,
      protocol: 'http',
    };
  }

  useEffect(() => {
    if (editLb) {
      setName(editLb.name);
      setListenPort(editLb.listenPort);
      setUpstreams(
        editLb.upstreams.map((u) => ({
          host: u.host,
          weight: u.weight,
          maxFails: u.maxFails,
          failTimeout: u.failTimeout,
          isBackup: u.isBackup,
          isActive: u.isActive,
          protocol: u.protocol || 'http',
        })),
      );
    } else {
      setName('');
      setListenPort(80);
      setUpstreams([defaultUpstream()]);
    }
    setActiveTab('details');
  }, [editLb, isOpen]);

  if (!isOpen) return null;

  const handleUpstreamChange = (index: number, data: UpstreamFormData) => {
    const updated = [...upstreams];
    updated[index] = data;
    setUpstreams(updated);
  };

  const handleUpstreamRemove = (index: number) => {
    setUpstreams(upstreams.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const validUpstreams = upstreams.filter((u) => u.host.trim());
    if (validUpstreams.length === 0) return;

    setSaving(true);
    try {
      onSave({
        name: name.trim(),
        listenPort,
        upstreams: validUpstreams,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="header-logo" style={{ width: 32, height: 32 }}>
              {editLb ? <Settings size={18} /> : <Plus size={18} />}
            </div>
            <h2>{editLb ? 'Edit Load Balancer' : 'New Load Balancer'}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <div 
            className={`modal-tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </div>
          <div 
            className={`modal-tab ${activeTab === 'upstreams' ? 'active' : ''}`}
            onClick={() => setActiveTab('upstreams')}
          >
            Upstreams ({upstreams.length})
          </div>
        </div>

        <div className="modal-body" style={{ minHeight: '300px' }}>
          {activeTab === 'details' && (
            <div className="tab-content">
              <div className="form-group">
                <label>Service Name</label>
                <input
                  className="form-input"
                  placeholder="webapp-lb"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="form-hint">Unique name for this load balancer (e.g., app-production)</p>
              </div>
              <div className="form-group">
                <label>Public Listen Port</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={65535}
                  value={listenPort}
                  onChange={(e) => setListenPort(parseInt(e.target.value) || 80)}
                />
                <p className="form-hint">Port nginx will listen on for incoming traffic (usually 80 or 443)</p>
              </div>
            </div>
          )}

          {activeTab === 'upstreams' && (
            <div className="tab-content">
              <div className="upstream-editor">
                <div className="upstream-editor-header">
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Add target servers that will receive the traffic.
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setUpstreams([...upstreams, defaultUpstream()])}
                  >
                    <Plus size={14} /> Add Server
                  </button>
                </div>

                {upstreams.map((u, i) => (
                  <UpstreamRow
                    key={i}
                    index={i}
                    data={u}
                    onChange={handleUpstreamChange}
                    onRemove={handleUpstreamRemove}
                    canRemove={upstreams.length > 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Processing...' : editLb ? 'Save Changes' : 'Deploy Balancer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ───────────────────────────────

function DeleteModal({
  lb,
  onClose,
  onConfirm,
}: {
  lb: LoadBalancer | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!lb) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: 'var(--accent-rose)' }}>
            <Trash2 size={32} />
          </div>
          <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>Delete Load Balancer?</h2>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 8px' }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text)', padding: '2px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>{lb.name}</strong>?
            </p>
            <p style={{ margin: 0, fontSize: '12px' }}>
              This config will be permanently deleted and traffic to these upstreams will stop. This cannot be undone.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={onConfirm}>
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Config Preview Modal ────────────────────────────────────

function PreviewModal({
  lb,
  config,
  onClose,
}: {
  lb: LoadBalancer | null;
  config: string;
  onClose: () => void;
}) {
  if (!lb) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div className="header-logo" style={{ width: 32, height: 32, background: 'var(--accent-cyan)' }}>
              <FileText size={18} />
            </div>
            <h2>Nginx Config: {lb.name}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
             <Layers size={14} color="var(--accent-cyan)" />
             <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
               Location: /data/nginx/custom/{lb.name}.conf
             </span>
          </div>
          <div className="config-preview">{config}</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LB Card Component ───────────────────────────────────────

function LbCard({
  lb,
  onEdit,
  onDelete,
  onToggle,
  onPreview,
  onDuplicate,
}: {
  lb: LoadBalancer;
  onEdit: (lb: LoadBalancer) => void;
  onDelete: (lb: LoadBalancer) => void;
  onToggle: (lb: LoadBalancer) => void;
  onPreview: (lb: LoadBalancer) => void;
  onDuplicate: (lb: LoadBalancer) => void;
}) {
  const activeUpstreams = lb.upstreams.filter((u) => u.isActive);
  const totalWeight = activeUpstreams
    .filter((u) => !u.isBackup)
    .reduce((s, u) => s + u.weight, 0);

  return (
    <div className="lb-card">
      <div className="lb-card-header">
        <div className="lb-card-title">
          <span className={`status-dot ${lb.status}`} />
          <h3>{lb.name}</h3>
        </div>
        <div className="lb-card-actions">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onDuplicate(lb)}
            title="Duplicate Configuration"
          >
            <Copy size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onPreview(lb)}
            title="Preview Configuration"
          >
            <FileText size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onEdit(lb)}
            title="Modify Settings"
          >
            <Settings size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onToggle(lb)}
            title={lb.status === 'active' ? 'Stop Distribution' : 'Start Distribution'}
            style={{ color: lb.status === 'active' ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}
          >
            {lb.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onDelete(lb)}
            title="Remove Balancer"
            style={{ color: 'var(--accent-rose)' }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="lb-card-body">
        <div className="lb-card-meta">
          <span className="meta-tag">
            <span className="label">PORT</span> {lb.listenPort}
          </span>
          <span className="meta-tag">
            <span className="label">NODES</span> {lb.upstreams.length}
          </span>
          <span className={`badge badge-${lb.status}`}>{lb.status}</span>
        </div>

        <div className="upstream-section">
          <h4>Nodes & Traffic</h4>
          <div className="upstream-list">
            {lb.upstreams.map((u, i) => (
              <UpstreamItem key={i} upstream={u} totalWeight={totalWeight} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UpstreamItem({
  upstream: u,
  totalWeight,
}: {
  upstream: Upstream;
  totalWeight: number;
}) {
  const pct =
    !u.isBackup && totalWeight > 0
      ? Math.round((u.weight / totalWeight) * 100)
      : 0;

  return (
    <div className="upstream-item" style={{ opacity: u.isActive ? 1 : 0.5 }}>
      <span className={`upstream-dot ${u.isBackup ? 'backup' : 'primary'}`} />
      <span className="upstream-host">
        {u.protocol}://{u.host}
      </span>
      <div className="upstream-badges">
        {u.isBackup ? (
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)' }}>
            Backup
          </span>
        ) : (
          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            {pct}%
          </span>
        )}
        {u.protocol === 'https' && (
          <Shield size={12} color="var(--accent-cyan)" />
        )}
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────

function App({ onLogout }: { onLogout?: () => void }) {
  const [loadBalancers, setLoadBalancers] = useState<LoadBalancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editLb, setEditLb] = useState<LoadBalancer | null>(null);
  const [deleteLb, setDeleteLb] = useState<LoadBalancer | null>(null);
  const [previewLb, setPreviewLb] = useState<LoadBalancer | null>(null);
  const [previewConfig, setPreviewConfig] = useState('');

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchLbs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listLb();
      setLoadBalancers(data);
    } catch (err) {
      addToast(`Failed to fetch configurations: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchLbs();
  }, [fetchLbs]);

  // Stats
  const totalLbs = loadBalancers.length;
  const activeLbs = loadBalancers.filter((lb) => lb.status === 'active').length;
  const totalUpstreams = loadBalancers.reduce(
    (s, lb) => s + lb.upstreams.length,
    0,
  );
  const backupUpstreams = loadBalancers.reduce(
    (s, lb) => s + lb.upstreams.filter((u) => u.isBackup).length,
    0,
  );

  // ── Handlers ────────────────────────────────────────────

  const handleCreate = () => {
    setEditLb(null);
    setShowModal(true);
  };

  const handleEdit = (lb: LoadBalancer) => {
    setEditLb(lb);
    setShowModal(true);
  };

  const handleSave = async (data: CreateLbPayload) => {
    try {
      if (editLb) {
        await api.updateLb(editLb.id, data);
        addToast(`Successfully updated cluster "${data.name}"`, 'success');
      } else {
        await api.createLb(data);
        addToast(`New load balancer "${data.name}" deployed`, 'success');
      }
      setShowModal(false);
      fetchLbs();
    } catch (err) {
      addToast(`Deployment failed: ${err}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteLb) return;
    try {
      await api.deleteLb(deleteLb.id);
      addToast(`"${deleteLb.name}" has been decommissioned`, 'success');
      setDeleteLb(null);
      fetchLbs();
    } catch (err) {
      addToast(`Deletion failed: ${err}`, 'error');
    }
  };

  const handleToggle = async (lb: LoadBalancer) => {
    try {
      await api.toggleLb(lb.id);
      addToast(
        `Service "${lb.name}" is now ${lb.status === 'active' ? 'offline' : 'online'}`,
        'success',
      );
      fetchLbs();
    } catch (err) {
      addToast(`Toggle status failed: ${err}`, 'error');
    }
  };

  const handlePreview = async (lb: LoadBalancer) => {
    try {
      const config = await api.previewLb(lb.id);
      setPreviewLb(lb);
      setPreviewConfig(config);
    } catch (err) {
      addToast(`Could not fetch configuration: ${err}`, 'error');
    }
  };

  const handleDuplicate = async (lb: LoadBalancer) => {
    try {
      const shortHash = Math.random().toString(36).substring(2, 6);
      const data: CreateLbPayload = {
        name: `${lb.name}-copy-${shortHash}`,
        listenPort: lb.listenPort,
        status: 'inactive',
        upstreams: lb.upstreams.map((u) => ({
          host: u.host,
          weight: u.weight,
          maxFails: u.maxFails,
          failTimeout: u.failTimeout,
          isBackup: u.isBackup,
          isActive: u.isActive,
          protocol: u.protocol || 'http',
        })),
      };
      await api.createLb(data);
      addToast(`Duplicated "${lb.name}" successfully`, 'success');
      fetchLbs();
    } catch (err) {
      addToast(`Duplication failed: ${err}`, 'error');
    }
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="layout">
      <ToastContainer toasts={toasts} />

      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            <div className="header-logo">LB</div>
            <div>
              <h1>NPM Load Balancer</h1>
              <p className="header-subtitle">Extended Module for Nginx Proxy Manager</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-sm" onClick={fetchLbs}>
              <RefreshCw size={14} className={loading && loadBalancers.length > 0 ? 'spin' : ''} /> Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>
              <Plus size={16} /> New Load Balancer
            </button>
            {onLogout && (
              <button 
                className="btn btn-icon btn-sm" 
                onClick={onLogout}
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="app">
        {/* Stats Dashboard */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-icon blue"><Activity size={20} /></div>
            <div className="stat-info">
              <h3>{totalLbs}</h3>
              <p>Proxy Hosts</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle2 size={20} /></div>
            <div className="stat-info">
              <h3>{activeLbs}</h3>
              <p>Active</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan"><Server size={20} /></div>
            <div className="stat-info">
              <h3>{totalUpstreams}</h3>
              <p>Upstreams</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Database size={20} /></div>
            <div className="stat-info">
              <h3>{backupUpstreams}</h3>
              <p>Backups</p>
            </div>
          </div>
        </div>

        {/* Load Balancer Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" />
            Service Clusters
          </h2>
        </div>

        {loading && loadBalancers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '6rem 0' }}>
            <RefreshCw size={48} className="spin" color="var(--primary)" />
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Provisioning data...</span>
          </div>
        ) : (
          <div className="lb-grid">
            {loadBalancers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🛰️</div>
                <h3>No Traffic Nodes Detected</h3>
                <p>
                  Start by deploying your first load balancer to manage incoming traffic across multiple upstream servers.
                </p>
                <button className="btn btn-primary" onClick={handleCreate}>
                  <Plus size={16} /> Create First Balancer
                </button>
              </div>
            ) : (
              loadBalancers.map((lb) => (
                <LbCard
                  key={lb.id}
                  lb={lb}
                  onEdit={handleEdit}
                  onDelete={setDeleteLb}
                  onToggle={handleToggle}
                  onPreview={handlePreview}
                  onDuplicate={handleDuplicate}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <LbModal
        isOpen={showModal}
        editLb={editLb}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />
      <DeleteModal
        lb={deleteLb}
        onClose={() => setDeleteLb(null)}
        onConfirm={handleDelete}
      />
      <PreviewModal
        lb={previewLb}
        config={previewConfig}
        onClose={() => setPreviewLb(null)}
      />

      <style>{`
        .spin { animation: rotate 2s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default App;
