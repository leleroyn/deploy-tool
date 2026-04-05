import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Rocket, Play, CheckCircle, XCircle, Loader, Upload, File, Trash2,
  ShieldCheck, ShieldAlert, FolderOpen, RefreshCw, AlertTriangle,
  Server, HardDrive, RotateCcw, Tag, Terminal
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { api } from '../api/http';
import { createTaskWs } from '../api/ws';
import TaskStatusBadge from '../components/TaskStatusBadge';
import { TaskStatus, PreflightData, LocalDirFile } from '../types';

const steps = ['打包文件', '上传到服务器', '远程解压', '执行重启'];

const DeployPage: React.FC = () => {
  const location = useLocation();
  const { projects, loadProjects } = useAppStore();
  const [selectedProject, setSelectedProject] = useState<string>(
    (location.state as any)?.project || ''
  );
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const terminalRef = useRef<HTMLPreElement>(null);
  const [terminalOutput, setTerminalOutput] = useState('');
  const wsCloseRef = useRef<(() => void) | null>(null);

  // 预检状态
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  // 上传状态
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // 切换项目时自动触发预检
  useEffect(() => {
    if (!selectedProject) {
      setPreflight(null);
      return;
    }
    loadPreflight();
  }, [selectedProject]);

  const loadPreflight = async () => {
    if (!selectedProject) return;
    setPreflightLoading(true);
    setPreflightError(null);
    const res = await api.deployPreflight(selectedProject);
    setPreflightLoading(false);
    if (res.success && res.data) {
      setPreflight(res.data);
    } else {
      setPreflightError(res.error || '预检失败');
    }
  };

  // ── 上传处理 ──────────────────────────────────────────

  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    setUploadProgress(0);
    const res = await api.deployUpload(selectedProject, file, (pct) => setUploadProgress(pct));
    setUploadProgress(null);
    if (res.success) {
      // 刷新文件列表
      loadPreflight();
    } else {
      setUploadError(res.error || '上传失败');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  }, [selectedProject]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  // ── 删除文件 ──────────────────────────────────────────

  const handleDeleteFile = async (filename: string) => {
    const res = await api.deployDeleteFile(selectedProject, filename);
    if (res.success) {
      loadPreflight();
    }
  };

  // ── 部署 ──────────────────────────────────────────────

  const handleDeploy = async () => {
    if (!selectedProject || isRunning) return;

    setTerminalOutput('部署任务启动中...\n');
    setIsRunning(true);
    setTaskStatus('running');
    setCurrentStep(0);

    const res = await api.deploy(selectedProject, false);
    if (!res.success || !res.data) {
      setTaskStatus('failed');
      setIsRunning(false);
      setTerminalOutput(prev => prev + `\n[错误] ${res.error || '启动失败'}\n`);
      return;
    }

    const taskId = res.data.id;

    if (wsCloseRef.current) wsCloseRef.current();
    wsCloseRef.current = createTaskWs(taskId, (msg) => {
      if (msg.type === 'log') {
        setTerminalOutput(prev => prev + msg.data);
        const text = msg.data;
        if (text.includes('打包')) setCurrentStep(0);
        if (text.includes('上传')) setCurrentStep(1);
        if (text.includes('远程解压')) setCurrentStep(2);
        if (text.includes('重启')) setCurrentStep(3);
      }
      if (msg.type === 'complete') {
        const status = msg.data as TaskStatus;
        setTaskStatus(status);
        setIsRunning(false);
        if (status === 'success') setCurrentStep(steps.length);
        loadPreflight();
      }
    });
  };

  const canDeploy = !!selectedProject && !isRunning && !!preflight?.backup.backed;

  // ── 渲染 ──────────────────────────────────────────────

  const renderPreflightPanel = () => {
    if (!selectedProject) return null;

    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-5">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary-light" />
            部署前检查
          </h2>
          <button
            onClick={loadPreflight}
            disabled={preflightLoading}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={preflightLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {preflightLoading && (
          <div className="flex items-center gap-2 text-sm text-text-secondary py-2">
            <Loader size={14} className="animate-spin" />
            检测中...
          </div>
        )}

        {preflightError && (
          <div className="flex items-center gap-2 text-sm text-status-error">
            <XCircle size={14} />
            {preflightError}
          </div>
        )}

        {preflight && !preflightLoading && (
          <>
            {/* 备份状态 */}
            <div className={`rounded-lg p-4 border ${
              preflight.backup.backed
                ? 'bg-status-success/5 border-status-success/30'
                : 'bg-status-error/5 border-status-error/30'
            }`}>
              {/* 总体状态标题 */}
              <div className="flex items-center gap-2 mb-2">
                {preflight.backup.backed
                  ? <CheckCircle size={16} className="text-status-success flex-shrink-0" />
                  : <ShieldAlert size={16} className="text-status-error flex-shrink-0" />}
                <span className={`text-sm font-medium ${preflight.backup.backed ? 'text-status-success' : 'text-status-error'}`}>
                  {preflight.backup.backed ? '今日已备份 ✓' : '今日尚未备份 ✗'}
                </span>
              </div>

              {/* 每台服务器明细 */}
              {preflight.backup.servers && preflight.backup.servers.length > 0 && (
                <div className="mt-2 space-y-1.5 pl-6">
                  {preflight.backup.servers.map(srv => (
                    <div key={srv.server} className="flex items-start gap-2 text-xs">
                      {srv.success
                        ? <CheckCircle size={12} className="text-status-success flex-shrink-0 mt-0.5" />
                        : <XCircle size={12} className="text-status-error flex-shrink-0 mt-0.5" />}
                      <div>
                        <span className={`font-mono font-medium ${srv.success ? 'text-status-success' : 'text-status-error'}`}>
                          {srv.server}
                        </span>
                        {srv.success && srv.time && (
                          <span className="text-text-secondary ml-2">{srv.time}</span>
                        )}
                        {srv.success && srv.backupFile && (
                          <div className="text-text-secondary font-mono truncate max-w-xs mt-0.5" title={srv.backupFile}>
                            {srv.backupFile.split('/').pop()}
                          </div>
                        )}
                        {!srv.success && (
                          <span className="text-text-secondary ml-2">今日尚无成功记录</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 总体说明 & 警告 */}
              <div className="text-xs text-text-secondary mt-2 pl-6">{preflight.backup.detail}</div>
              {!preflight.backup.backed && (
                <div className="flex items-center gap-1.5 mt-2 pl-6 text-xs text-amber-500">
                  <AlertTriangle size={12} />
                  建议先完成备份再部署，以便出错时可快速回滚
                </div>
              )}
            </div>

            {/* local_dir 文件列表 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={14} className="text-text-secondary" />
                <span className="text-xs text-text-secondary">部署包存放目录</span>
                <code className="text-xs bg-bg-tertiary border border-border rounded px-2 py-0.5 text-text-primary font-mono">
                  {preflight.localDir || '（未配置 local_dir）'}
                </code>
              </div>

              {!preflight.localDir ? (
                <div className="text-xs text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  请先在设置页为该项目配置 local_dir 路径
                </div>
              ) : !preflight.localDirExists ? (
                <div className="text-xs text-text-secondary">目录不存在，上传文件后将自动创建</div>
              ) : preflight.files.length === 0 ? (
                <div className="text-xs text-text-secondary">目录为空，请上传部署包</div>
              ) : (
                <div className="space-y-1">
                  {preflight.files.map(f => (
                    <FileRow key={f.name} file={f} onDelete={() => handleDeleteFile(f.name)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderUploadPanel = () => {
    if (!selectedProject || !preflight?.localDir) return null;

    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Upload size={16} className="text-primary-light" />
          上传部署包
        </h2>

        {/* 拖拽区域 */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-primary bg-primary/8 scale-[1.01]'
              : 'border-border hover:border-primary/50 hover:bg-bg-tertiary'
          }`}
        >
          {uploadProgress !== null ? (
            <div className="space-y-3">
              <Loader size={24} className="mx-auto text-primary animate-spin" />
              <div className="text-sm text-text-secondary">上传中 {uploadProgress}%</div>
              <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload size={28} className={`mx-auto mb-3 ${isDragOver ? 'text-primary' : 'text-text-secondary'}`} />
              <div className="text-sm text-text-primary font-medium">拖拽文件到此处，或点击选择文件</div>
              <div className="text-xs text-text-secondary mt-1.5">
                文件将上传至 <span className="font-mono">{preflight.localDir}</span>
              </div>
              <div className="text-xs text-text-secondary mt-1">.zip / .tar.gz / .tar 将自动解压，其他格式直接存放，最大 500MB</div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-status-error">
            <XCircle size={14} />
            {uploadError}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 顶部：配置 + 执行按钮 */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h2 className="text-[14px] font-semibold text-text-primary mb-5 flex items-center gap-2">
          <Rocket size={16} className="text-primary-light" />
          部署配置
        </h2>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-text-secondary mb-2">选择项目</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={isRunning}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
            >
              <option value="">-- 请选择项目 --</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDeploy}
              disabled={!canDeploy}
              title={!preflight?.backup.backed ? '今日尚未备份，请先执行备份后再部署' : ''}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isRunning ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              {isRunning ? '部署中...' : '执行部署'}
            </button>

            {!isRunning && selectedProject && preflight && !preflight.backup.backed && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                请先备份
              </span>
            )}

            {taskStatus && <TaskStatusBadge status={taskStatus} />}
          </div>
        </div>

        {/* 项目配置信息卡片 */}
        {selectedProject && (() => {
          const proj = projects.find(p => p.name === selectedProject);
          if (!proj) return null;
          return (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              <div className="flex items-start gap-2 text-xs">
                <Server size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">目标服务器</span>
                  <span className="font-mono text-text-primary">{proj.server.join('、') || '—'}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <HardDrive size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">远程目录</span>
                  <span className="font-mono text-text-primary">{proj.remoteDir || '—'}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <FolderOpen size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">备份目录</span>
                  <span className="font-mono text-text-primary">{proj.backupDir || '—'}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <RotateCcw size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">重启命令</span>
                  <span className="font-mono text-text-primary">{proj.restartCmd || '—'}</span>
                  {proj.restartCmd && (
                    <span className="ml-2 text-[11px] text-status-success italic">（部署成功后自动执行）</span>
                  )}
                </div>
              </div>
              {proj.bindPorts.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <Tag size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-text-secondary mr-2">监听端口</span>
                    <span className="font-mono text-text-primary">{proj.bindPorts.join('、')}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 两栏：预检 + 上传 */}
      {selectedProject && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {renderPreflightPanel()}
          {renderUploadPanel()}
        </div>
      )}

      {/* 进度步骤 */}
      {(isRunning || taskStatus) && (
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <h3 className="text-xs text-text-secondary mb-4">部署进度</h3>
          <div className="flex items-center gap-2">
            {steps.map((step, idx) => {
              const done = currentStep > idx || taskStatus === 'success';
              const active = currentStep === idx && isRunning;
              const failed = taskStatus === 'failed' && currentStep === idx;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                      failed ? 'bg-status-error/20 border-status-error text-status-error' :
                      done ? 'bg-status-success/20 border-status-success text-status-success' :
                      active ? 'bg-primary/20 border-primary-light text-primary-light animate-pulse' :
                      'bg-bg-tertiary border-border text-text-secondary'
                    }`}>
                      {failed ? <XCircle size={14} /> :
                       done ? <CheckCircle size={14} /> :
                       active ? <Loader size={12} className="animate-spin" /> :
                       <span className="text-[10px]">{idx + 1}</span>}
                    </div>
                    <span className="text-[10px] text-text-secondary text-center">{step}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`h-px flex-1 mt-[-12px] transition-colors ${done ? 'bg-status-success/50' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 终端输出 */}
      {terminalOutput && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Terminal size={14} />
            执行输出
          </h2>
          <pre className="bg-bg-tertiary border border-border rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
            {terminalOutput}
          </pre>
        </div>
      )}
    </div>
  );
};

// ── 文件行组件 ──────────────────────────────────────────

const FileRow: React.FC<{ file: LocalDirFile; onDelete: () => void }> = ({ file, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleDeleteClick = () => setConfirming(true);

  const handleConfirm = async () => {
    setConfirming(false);
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-tertiary border border-border/50 group">
      <File size={13} className="text-text-secondary flex-shrink-0" />
      <span className="text-sm text-text-primary flex-1 truncate font-mono">{file.name}</span>
      <span className="text-xs text-text-secondary flex-shrink-0">{file.size}</span>
      <span className="text-xs text-text-secondary flex-shrink-0 hidden sm:block">
        {new Date(file.mtime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </span>

      {confirming ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-status-error">确认删除?</span>
          <button
            onClick={handleConfirm}
            className="text-xs px-1.5 py-0.5 rounded bg-status-error text-white hover:bg-red-600 transition-colors"
          >是</button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
          >否</button>
        </div>
      ) : (
        <button
          onClick={handleDeleteClick}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-status-error transition-all disabled:opacity-30 flex-shrink-0"
          title="删除"
        >
          {deleting ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      )}
    </div>
  );
};

export default DeployPage;
