import React, { useEffect, useState } from 'react';
import { Settings, Key, Server, Plus, Trash2, ChevronDown, ChevronUp, Save, Loader } from 'lucide-react';
import { api } from '../api/http';
import { useAppStore } from '../store/appStore';
import { Project, SSHConfig } from '../types';

const SettingsPage: React.FC = () => {
  const { loadProjects } = useAppStore();
  const [sshConfig, setSSHConfig] = useState<SSHConfig>({ user: '', key: '' });
  const [sshSaving, setSSHSaving] = useState(false);
  const [sshMsg, setSSHMsg] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Project>>({});
  const [projSaving, setProjSaving] = useState(false);
  const [projMsg, setProjMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProject, setNewProject] = useState<Partial<Project>>({ name: '', server: [], bindPorts: [], localDir: '', remoteDir: '', backupDir: '', restartCmd: '', exclude: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [sshRes, projRes] = await Promise.all([api.getSSHConfig(), api.getProjects()]);
    if (sshRes.success && sshRes.data) setSSHConfig(sshRes.data);
    if (projRes.success && projRes.data) setProjects(projRes.data);
  };

  const handleSaveSSH = async () => {
    setSSHSaving(true);
    setSSHMsg('');
    const res = await api.updateSSHConfig(sshConfig);
    setSSHSaving(false);
    setSSHMsg(res.success ? '保存成功' : (res.error || '保存失败'));
    if (res.success) setTimeout(() => setSSHMsg(''), 2000);
  };

  const handleExpandProject = (name: string) => {
    if (expandedProject === name) {
      setExpandedProject(null);
    } else {
      const proj = projects.find(p => p.name === name);
      if (proj) {
        setEditData({
          server: [...proj.server],
          remoteDir: proj.remoteDir,
          backupDir: proj.backupDir,
          localDir: proj.localDir,
          exclude: proj.exclude,
          restartCmd: proj.restartCmd,
          bindPorts: [...proj.bindPorts],
        });
      }
      setExpandedProject(name);
      setProjMsg('');
    }
  };

  const handleSaveProject = async (name: string) => {
    setProjSaving(true);
    setProjMsg('');
    const res = await api.updateProject(name, editData);
    setProjSaving(false);
    if (res.success) {
      setProjMsg('保存成功');
      loadData();
      loadProjects();
      setTimeout(() => setProjMsg(''), 2000);
    } else {
      setProjMsg(res.error || '保存失败');
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (!confirm(`确认删除项目 ${name}？`)) return;
    await api.deleteProject(name);
    setExpandedProject(null);
    loadData();
    loadProjects();
  };

  const handleAddProject = async () => {
    if (!newProject.name) return;
    const proj: Project = {
      name: newProject.name!,
      server: newProject.server || [],
      remoteDir: newProject.remoteDir || '',
      backupDir: newProject.backupDir || '',
      localDir: newProject.localDir || '',
      exclude: newProject.exclude || 'logs,log,tmp,temp,*.log',
      restartCmd: newProject.restartCmd || '',
      bindPorts: newProject.bindPorts || [],
    };
    const res = await api.createProject(proj);
    if (res.success) {
      setShowAddForm(false);
      setNewProject({ name: '', server: [], bindPorts: [] });
      loadData();
      loadProjects();
    }
  };

  return (
    <div className="space-y-6">
      {/* SSH Config */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h2 className="text-[14px] font-semibold text-text-primary mb-5 flex items-center gap-2">
          <Key size={15} className="text-status-warning" />
          SSH 全局配置
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">SSH 用户名</label>
            <input
              type="text"
              value={sshConfig.user}
              onChange={(e) => setSSHConfig({ ...sshConfig, user: e.target.value })}
              placeholder="root"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">SSH 私钥路径</label>
            <input
              type="text"
              value={sshConfig.key}
              onChange={(e) => setSSHConfig({ ...sshConfig, key: e.target.value })}
              placeholder="/home/ubuntu/.ssh/id_rsa"
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSSH}
              disabled={sshSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              {sshSaving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
              保存
            </button>
            {sshMsg && (
              <span className={`text-xs ${sshMsg === '保存成功' ? 'text-status-success' : 'text-status-error'}`}>
                {sshMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Projects Config */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
            <Server size={15} className="text-primary-light" />
            项目配置
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary-light border border-primary/20 hover:bg-primary/20 transition-all"
          >
            <Plus size={12} />
            新增项目
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-4 p-4 border border-primary/20 rounded-lg bg-primary/5">
            <p className="text-xs text-primary-light mb-3 font-medium">新增项目</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'name', label: '项目名称', placeholder: 'my-project' },
                { key: 'server', label: '服务器 IP（逗号分隔）', placeholder: '192.168.1.1' },
                { key: 'remoteDir', label: '远程目录', placeholder: '/opt/project' },
                { key: 'backupDir', label: '备份目录', placeholder: '/opt/backup' },
                { key: 'localDir', label: '本地源目录', placeholder: '/path/to/local' },
                { key: 'restartCmd', label: '重启命令', placeholder: 'docker restart app' },
                { key: 'bindPorts', label: '端口（逗号分隔）', placeholder: '8080,3306' },
                { key: 'exclude', label: '排除规则', placeholder: 'logs,*.log' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[11px] text-text-secondary mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={
                      key === 'server' ? (newProject.server || []).join(',') :
                      key === 'bindPorts' ? (newProject.bindPorts || []).join(',') :
                      (newProject as any)[key] || ''
                    }
                    onChange={(e) => {
                      if (key === 'server') {
                        setNewProject({ ...newProject, server: e.target.value.split(',').map(s => s.trim()) });
                      } else if (key === 'bindPorts') {
                        setNewProject({ ...newProject, bindPorts: e.target.value.split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n)) });
                      } else {
                        setNewProject({ ...newProject, [key]: e.target.value });
                      }
                    }}
                    className="w-full bg-bg-tertiary border border-border rounded px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/60"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleAddProject} className="px-3 py-1.5 text-xs bg-primary/80 hover:bg-primary text-white rounded-lg transition-all">
                添加
              </button>
              <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-secondary border border-border rounded-lg transition-all hover:text-text-primary">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="space-y-2">
          {projects.map((proj) => (
            <div key={proj.name} className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-tertiary transition-all"
                onClick={() => handleExpandProject(proj.name)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-text-primary">{proj.name}</span>
                  <span className="text-[11px] text-text-secondary">{proj.server.join(', ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.name); }}
                    className="p-1 rounded text-text-secondary hover:text-status-error hover:bg-status-error/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                  {expandedProject === proj.name ? <ChevronUp size={14} className="text-text-secondary" /> : <ChevronDown size={14} className="text-text-secondary" />}
                </div>
              </div>

              {expandedProject === proj.name && (
                <div className="border-t border-border p-4 bg-bg-tertiary/30">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'server', label: '服务器 IP（逗号分隔）' },
                      { key: 'remoteDir', label: '远程目录' },
                      { key: 'backupDir', label: '备份目录' },
                      { key: 'localDir', label: '本地源目录' },
                      { key: 'restartCmd', label: '重启命令' },
                      { key: 'exclude', label: '排除规则' },
                      { key: 'bindPorts', label: '端口（逗号分隔）' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-[11px] text-text-secondary mb-1">{label}</label>
                        <input
                          type="text"
                          value={
                            key === 'server' ? ((editData.server || []).join(',')) :
                            key === 'bindPorts' ? ((editData.bindPorts || []).join(',')) :
                            (editData as any)[key] || ''
                          }
                          onChange={(e) => {
                            if (key === 'server') {
                              setEditData({ ...editData, server: e.target.value.split(',').map(s => s.trim()) });
                            } else if (key === 'bindPorts') {
                              setEditData({ ...editData, bindPorts: e.target.value.split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n)) });
                            } else {
                              setEditData({ ...editData, [key]: e.target.value });
                            }
                          }}
                          className="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-primary/60"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => handleSaveProject(proj.name)}
                      disabled={projSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/80 hover:bg-primary text-white rounded-lg transition-all disabled:opacity-50"
                    >
                      {projSaving ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
                      保存修改
                    </button>
                    {projMsg && (
                      <span className={`text-xs ${projMsg === '保存成功' ? 'text-status-success' : 'text-status-error'}`}>
                        {projMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
