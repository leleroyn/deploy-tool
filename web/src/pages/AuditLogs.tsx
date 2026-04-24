import React, { useEffect, useState, useCallback } from 'react';
import { Search, RotateCcw, Loader, ShieldAlert } from 'lucide-react';
import { api } from '../api/http';
import { AuditLog, AuditEventType } from '../types';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const [filters, setFilters] = useState({
    username: '',
    eventType: '',
    target: '',
    result: '',
    operatorIp: '',
    startTime: '',
    endTime: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await api.getAuditLogs({
      ...filters,
      page,
      limit,
    });
    if (res.success) {
      setLogs(res.data || []);
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleReset = () => {
    setFilters({
      username: '',
      eventType: '',
      target: '',
      result: '',
      operatorIp: '',
      startTime: '',
      endTime: '',
    });
    setPage(1);
  };

  const resultColor = (result: string) => {
    if (result === '成功') return 'text-status-success';
    if (result === '失败') return 'text-status-error';
    return 'text-text-primary';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <ShieldAlert size={18} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-text-primary">审计日志筛选</h2>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">操作人员</label>
            <input
              type="text"
              value={filters.username}
              onChange={(e) => { setFilters({ ...filters, username: e.target.value }); setPage(1); }}
              placeholder="用户名"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">事件类型</label>
            <select
              value={filters.eventType}
              onChange={(e) => { setFilters({ ...filters, eventType: e.target.value }); setPage(1); }}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            >
              <option value="">全部类型</option>
              <option value={AuditEventType.LOGIN}>登录</option>
              <option value={AuditEventType.BACKUP}>备份</option>
              <option value={AuditEventType.DEPLOY}>部署</option>
              <option value={AuditEventType.REMOTE_CMD}>远程命令</option>
              <option value={AuditEventType.PORT_CHECK}>端口检测</option>
              <option value={AuditEventType.USER_MGMT}>用户管理</option>
              <option value={AuditEventType.SYS_SETTINGS}>系统设置</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">操作对象</label>
            <input
              type="text"
              value={filters.target}
              onChange={(e) => { setFilters({ ...filters, target: e.target.value }); setPage(1); }}
              placeholder="项目名/命令名"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">操作结果</label>
            <select
              value={filters.result}
              onChange={(e) => { setFilters({ ...filters, result: e.target.value }); setPage(1); }}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            >
              <option value="">全部结果</option>
              <option value="成功">成功</option>
              <option value="失败">失败</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">操作员IP</label>
            <input
              type="text"
              value={filters.operatorIp}
              onChange={(e) => { setFilters({ ...filters, operatorIp: e.target.value }); setPage(1); }}
              placeholder="IP 地址"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">开始时间</label>
            <input
              type="datetime-local"
              value={filters.startTime}
              onChange={(e) => { setFilters({ ...filters, startTime: e.target.value }); setPage(1); }}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-text-secondary">结束时间</label>
            <input
              type="datetime-local"
              value={filters.endTime}
              onChange={(e) => { setFilters({ ...filters, endTime: e.target.value }); setPage(1); }}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end border-t pt-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary text-sm transition-all"
          >
            <RotateCcw size={14} />
            重置
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            查询
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-bg-tertiary text-text-secondary text-[12px] font-medium">
            <tr>
              <th className="px-6 py-3 font-semibold">序号</th>
              <th className="px-6 py-3 font-semibold">操作人员</th>
              <th className="px-6 py-3 font-semibold">事件类型</th>
              <th className="px-6 py-3 font-semibold">操作对象</th>
              <th className="px-6 py-3 font-semibold">操作结果</th>
              <th className="px-6 py-3 font-semibold">IP 地址</th>
              <th className="px-6 py-3 font-semibold">操作时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-text-secondary text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <Loader size={16} className="animate-spin" />
                    加载中...
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-text-secondary text-sm">
                  暂无符合条件的审计记录
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr key={log.id} className="hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-6 py-3 text-sm text-text-secondary">{(page - 1) * limit + index + 1}</td>
                  <td className="px-6 py-3 text-sm text-text-primary font-medium">{log.operator_name}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium">
                      {log.event_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-text-primary font-mono">{log.target}</td>
                  <td className={`px-6 py-3 text-sm font-medium ${resultColor(log.result)}`}>{log.result}</td>
                  <td className="px-6 py-3 text-sm text-text-secondary font-mono">{log.operator_ip || '-'}</td>
                  <td className="px-6 py-3 text-sm text-text-secondary">
                      {(() => {
                        const ts = log.timestamp.replace(' ', 'T') + 'Z';
                        return new Date(ts).toLocaleString('zh-CN', { hour12: false });
                      })()}
                    </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="px-6 py-4 border-t flex items-center justify-between bg-bg-tertiary/20">
          <span className="text-xs text-text-secondary">
            共 {logs.length} 条记录 (当前页)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-xs rounded border border-border bg-white hover:bg-bg-tertiary disabled:opacity-50 transition-all"
            >
              上一页
            </button>
            <span className="text-xs text-text-primary px-2">
              第 {page} 页
            </span>
            <button
              disabled={logs.length < limit || loading}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-xs rounded border border-border bg-white hover:bg-bg-tertiary disabled:opacity-50 transition-all"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
