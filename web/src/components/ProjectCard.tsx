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
    <div className="relative bg-bg-secondary border border-border rounded-lg p-3 card-hover transition-all duration-300 group flex flex-col min-h-28">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Cpu size={14} className="text-primary-light" />
          </div>
          <div>
            <h3 className="text-text-primary font-semibold text-sm">{project.name}</h3>
            <p className="text-text-secondary text-[11px]">
              {project.server.length} 台服务器
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success status-online" />
          <span className="text-[11px] text-status-success">在线</span>
        </div>
      </div>

      {/* Body area (servers/ports) with flexible height to keep footer aligned */}
      <div className="flex-1 overflow-auto mb-2">
        {/* Server list - horizontal */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {project.server.map((srv) => (
            <div key={srv} className="flex items-center gap-1 text-[11px]">
              <Server size={11} className="text-text-secondary flex-shrink-0" />
              <span className="text-text-muted font-mono">{srv}</span>
            </div>
          ))}
        </div>

        {/* Ports - horizontal */}
        {project.bindPorts.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Globe size={11} className="text-text-secondary" />
            {project.bindPorts.map((port) => (
              <span
                key={port}
                className="px-1 py-0.5 rounded text-[10px] font-mono bg-primary-cyan/10 text-primary-cyan border border-primary-cyan/20"
              >
                :{port}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-1.5 pt-2 border-t border-border">
        <button
          onClick={() => { onBackup?.(); navigate('/backup', { state: { project: project.name } }); }}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium bg-bg-tertiary hover:bg-border text-text-muted border border-border hover:border-border/80 transition-all duration-200"
        >
          备份
        </button>
        <button
          onClick={() => { onDeploy?.(); navigate('/deploy', { state: { project: project.name } }); }}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary-light border border-primary/20 hover:border-primary/40 transition-all duration-200"
        >
          <Zap size={11} />
          部署
        </button>
        <button
          onClick={() => navigate('/ports', { state: { project: project.name } })}
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium bg-status-success/10 hover:bg-status-success/20 text-status-success border border-status-success/20 hover:border-status-success/40 transition-all duration-200"
        >
          <Radio size={11} />
          检测
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;
