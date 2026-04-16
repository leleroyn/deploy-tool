import React from 'react';
import { Project } from '../types';
import { Server, Cpu, Globe, Zap, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProjectCardProps {
  project: Project;
  onDeploy?: () => void;
  onBackup?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDeploy, onBackup }) => {
  const navigate = useNavigate();

  return (
    <div className="relative bg-bg-secondary border border-border rounded-xl p-5 card-hover transition-all duration-300 group flex flex-col min-h-48 md:min-h-60">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Cpu size={18} className="text-primary-light" />
          </div>
          <div>
            <h3 className="text-text-primary font-semibold text-[15px]">{project.name}</h3>
            <p className="text-text-secondary text-xs mt-0.5">
              {project.server.length} 台服务器
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-status-success status-online" />
          <span className="text-xs text-status-success">在线</span>
        </div>
      </div>

      {/* Body area (servers/ports) with flexible height to keep footer aligned */}
      <div className="flex-1 overflow-auto mb-4">
        {/* Server list */}
        <div className="space-y-1.5 mb-4">
          {project.server.map((srv) => (
            <div key={srv} className="flex items-center gap-2 text-xs">
              <Server size={12} className="text-text-secondary flex-shrink-0" />
              <span className="text-text-muted font-mono">{srv}</span>
            </div>
          ))}
        </div>

        {/* Ports */}
        {project.bindPorts.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Globe size={12} className="text-text-secondary" />
            {project.bindPorts.map((port) => (
              <span
                key={port}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-primary-cyan/10 text-primary-cyan border border-primary-cyan/20"
              >
                :{port}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-3 border-t border-border">
        <button
          onClick={() => { onBackup?.(); navigate('/backup', { state: { project: project.name } }); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-bg-tertiary hover:bg-border text-text-muted border border-border hover:border-border/80 transition-all duration-200"
        >
          备份
        </button>
        <button
          onClick={() => { onDeploy?.(); navigate('/deploy', { state: { project: project.name } }); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary-light border border-primary/20 hover:border-primary/40 transition-all duration-200"
        >
          <Zap size={12} />
          部署
        </button>
        <button
          onClick={() => navigate('/ports', { state: { project: project.name } })}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-status-success/10 hover:bg-status-success/20 text-status-success border border-status-success/20 hover:border-status-success/40 transition-all duration-200"
        >
          <Radio size={12} />
          检测
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;
