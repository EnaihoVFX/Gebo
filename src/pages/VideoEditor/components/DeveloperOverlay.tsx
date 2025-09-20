import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Terminal, 
  Database, 
  Activity, 
  Network, 
  Search, 
  Filter,
  Copy,
  Download,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Minimize2,
  Maximize2,
  Move,
  GripVertical
} from 'lucide-react';
import type { Range } from '../../../types';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  source?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  duration?: number;
  timestamp: Date;
  requestData?: any;
  responseData?: any;
}

interface DeveloperOverlayProps {
  debug: string;
  filePath: string;
  previewUrl: string;
  probe: any;
  peaks: number[];
  acceptedCuts: Range[];
  previewCuts: Range[];
  projectFile?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperOverlay({
  debug,
  filePath,
  previewUrl,
  probe,
  peaks,
  acceptedCuts,
  previewCuts,
  projectFile,
  isOpen,
  onClose
}: DeveloperOverlayProps) {
  const [activeTab, setActiveTab] = useState<'console' | 'state' | 'performance' | 'network'>('console');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'log' | 'info' | 'warn' | 'error' | 'debug'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'browser' | 'ffmpeg'>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['project-info', 'media-info']));
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Overlay mode states
  const [isMinimal, setIsMinimal] = useState(false);
  const [minimalPosition, setMinimalPosition] = useState({ x: 20, y: 20 });
  const [minimalSize, setMinimalSize] = useState({ width: 400, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Note: Browser console interception disabled for Tauri compatibility
  // Tauri's webview may have different console behavior that could interfere with rendering

  // Parse debug logs into structured format
  useEffect(() => {
    if (debug) {
      const debugLines = debug.split('\n').filter(line => line.trim());
      const newLogs: LogEntry[] = debugLines.map((line, index) => {
        const timestamp = new Date();
        let level: LogEntry['level'] = 'log';
        let message = line;
        
        // Try to parse log level from message
        if (line.includes('[ERROR]') || line.includes('Error:')) level = 'error';
        else if (line.includes('[WARN]') || line.includes('Warning:')) level = 'warn';
        else if (line.includes('[INFO]') || line.includes('Info:')) level = 'info';
        else if (line.includes('[DEBUG]') || line.includes('Debug:')) level = 'debug';
        
        return {
          id: `ffmpeg-${Date.now()}-${index}`,
          timestamp,
          level,
          message: line,
          source: 'ffmpeg'
        };
      });
      
      setLogs(prev => [...prev, ...newLogs].slice(-1000)); // Keep last 1000 logs
    }
  }, [debug]);

  // Auto-scroll to bottom of console
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const memoryUsage = (performance as any).memory;
      if (memoryUsage) {
        setPerformanceMetrics(prev => [
          ...prev.slice(-50), // Keep last 50 metrics
          {
            name: 'Memory Used',
            value: Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024),
            unit: 'MB',
            timestamp: new Date()
          },
          {
            name: 'Memory Total',
            value: Math.round(memoryUsage.totalJSHeapSize / 1024 / 1024),
            unit: 'MB',
            timestamp: new Date()
          }
        ]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = logFilter === 'all' || log.level === logFilter;
    const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
    return matchesSearch && matchesFilter && matchesSource;
  });

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info': return <Info className="w-4 h-4 text-blue-400" />;
      case 'debug': return <Terminal className="w-4 h-4 text-gray-400" />;
      default: return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-300 bg-red-900/20 border-red-800';
      case 'warn': return 'text-yellow-300 bg-yellow-900/20 border-yellow-800';
      case 'info': return 'text-blue-300 bg-blue-900/20 border-blue-800';
      case 'debug': return 'text-gray-300 bg-gray-900/20 border-gray-800';
      default: return 'text-green-300 bg-green-900/20 border-green-800';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-copilot-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Drag and resize handlers
  const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize') => {
    e.preventDefault();
    if (type === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - minimalPosition.x,
        y: e.clientY - minimalPosition.y
      });
    } else {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: minimalSize.width,
        height: minimalSize.height
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setMinimalPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      } else if (isResizing) {
        const newWidth = Math.max(300, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(200, resizeStart.height + (e.clientY - resizeStart.y));
        setMinimalSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart]);

  if (!isOpen) return null;

  // Minimal overlay mode
  if (isMinimal) {
    return (
      <div 
        className="fixed bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[9999] flex flex-col"
        style={{
          left: minimalPosition.x,
          top: minimalPosition.y,
          width: minimalSize.width,
          height: minimalSize.height,
        }}
      >
        {/* Minimal Header */}
        <div 
          className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-800 cursor-move select-none"
          onMouseDown={(e) => handleMouseDown(e, 'drag')}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Dev Console</span>
            <div className="flex items-center gap-1">
              {['console', 'state', 'performance'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimal(false)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Maximize"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Minimal Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'console' && (
            <div className="h-full flex flex-col">
              <div className="p-2 border-b border-slate-700 bg-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 flex-1"
                  />
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value as any)}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="error">Error</option>
                    <option value="warn">Warn</option>
                    <option value="info">Info</option>
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as any)}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Sources</option>
                    <option value="browser">Browser</option>
                    <option value="ffmpeg">FFmpeg</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 font-mono text-xs bg-slate-950">
                {filteredLogs.slice(-20).map(log => (
                  <div
                    key={log.id}
                    className={`mb-1 p-2 rounded border-l-2 ${getLogColor(log.level)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getLogIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-400 text-xs mb-1 flex items-center gap-2">
                          <span>{formatTimestamp(log.timestamp)}</span>
                          {log.source && (
                            <span className={`text-xs px-1 py-0.5 rounded ${
                              log.source === 'browser' 
                                ? 'bg-blue-900 text-blue-300' 
                                : 'bg-green-900 text-green-300'
                            }`}>
                              {log.source}
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap break-words text-xs">
                          {log.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'state' && (
            <div className="h-full overflow-y-auto p-2">
              <div className="space-y-2">
                <div className="bg-slate-800 p-2 rounded">
                  <div className="text-xs text-slate-400 mb-1">Project Info</div>
                  <div className="text-xs text-white">
                    <div>File: {filePath ? filePath.split('/').pop() : 'None'}</div>
                    <div>Duration: {probe?.duration ? `${probe.duration.toFixed(2)}s` : 'Unknown'}</div>
                    <div>Peaks: {peaks.length}</div>
                  </div>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <div className="text-xs text-slate-400 mb-1">Cuts</div>
                  <div className="text-xs text-white">
                    <div>Accepted: {acceptedCuts.length}</div>
                    <div>Preview: {previewCuts.length}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="h-full overflow-y-auto p-2">
              <div className="space-y-2">
                {performanceMetrics.slice(-5).map((metric, index) => (
                  <div key={index} className="bg-slate-800 p-2 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-300">{metric.name}</span>
                      <span className="text-xs text-white font-mono">
                        {metric.value} {metric.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
          onMouseDown={(e) => handleMouseDown(e, 'resize')}
        >
          <div className="w-full h-full bg-slate-600 hover:bg-slate-500 rounded-tl-lg"></div>
        </div>
      </div>
    );
  }

  // Full-screen mode
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-6xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Developer Console</h2>
            <div className="flex items-center gap-1">
              {['console', 'state', 'performance', 'network'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimal(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Minimize to Overlay"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'console' && (
            <div className="h-full flex flex-col">
              {/* Console Controls */}
              <div className="p-4 border-b border-slate-700 bg-slate-800">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value as any)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Levels</option>
                      <option value="log">Log</option>
                      <option value="info">Info</option>
                      <option value="warn">Warning</option>
                      <option value="error">Error</option>
                      <option value="debug">Debug</option>
                    </select>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value as any)}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Sources</option>
                      <option value="browser">Browser Console</option>
                      <option value="ffmpeg">FFmpeg</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearLogs}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={exportLogs}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-1 ${
                        autoScroll 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-slate-600 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {autoScroll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      Auto-scroll
                    </button>
                  </div>
                </div>
              </div>

              {/* Console Output */}
              <div 
                ref={consoleRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-slate-950"
              >
                {filteredLogs.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    No logs found. {searchTerm && 'Try adjusting your search or filter.'}
                  </div>
                ) : (
                  filteredLogs.map(log => (
                    <div
                      key={log.id}
                      className={`mb-2 p-3 rounded border-l-4 ${getLogColor(log.level)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getLogIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-slate-400 text-xs">
                              {formatTimestamp(log.timestamp)}
                            </span>
                            <span className="text-slate-500 text-xs">
                              [{log.level.toUpperCase()}]
                            </span>
                            {log.source && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                log.source === 'browser' 
                                  ? 'bg-blue-900 text-blue-300' 
                                  : 'bg-green-900 text-green-300'
                              }`}>
                                {log.source}
                              </span>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {log.message}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(log.message)}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="Copy log"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {activeTab === 'state' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                {/* Project Info */}
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <button
                    onClick={() => toggleSection('project-info')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-400" />
                      <h3 className="font-semibold text-white">Project Information</h3>
                    </div>
                    {expandedSections.has('project-info') ? 
                      <ChevronDown className="w-5 h-5 text-slate-400" /> : 
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    }
                  </button>
                  {expandedSections.has('project-info') && (
                    <div className="px-4 pb-4 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-slate-400 text-sm">File Path</label>
                          <div className="text-white font-mono text-sm break-all">{filePath || 'None'}</div>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">Preview URL</label>
                          <div className="text-white font-mono text-sm break-all">{previewUrl || 'None'}</div>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">Duration</label>
                          <div className="text-white font-mono text-sm">
                            {probe?.duration ? `${probe.duration.toFixed(2)}s` : 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">Peaks Samples</label>
                          <div className="text-white font-mono text-sm">{peaks.length}</div>
                        </div>
                      </div>
                      {projectFile && (
                        <div className="mt-4">
                          <label className="text-slate-400 text-sm">Project File Data</label>
                          <pre className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto mt-2">
                            {JSON.stringify(projectFile, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Media Info */}
                <div className="bg-slate-800 rounded-lg border border-slate-700">
                  <button
                    onClick={() => toggleSection('media-info')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-green-400" />
                      <h3 className="font-semibold text-white">Media Information</h3>
                    </div>
                    {expandedSections.has('media-info') ? 
                      <ChevronDown className="w-5 h-5 text-slate-400" /> : 
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    }
                  </button>
                  {expandedSections.has('media-info') && (
                    <div className="px-4 pb-4 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="text-slate-400 text-sm">Accepted Cuts</label>
                          <div className="text-white font-mono text-sm">{acceptedCuts.length}</div>
                        </div>
                        <div>
                          <label className="text-slate-400 text-sm">Preview Cuts</label>
                          <div className="text-white font-mono text-sm">{previewCuts.length}</div>
                        </div>
                      </div>
                      {acceptedCuts.length > 0 && (
                        <div className="mt-4">
                          <label className="text-slate-400 text-sm">Accepted Cuts Details</label>
                          <div className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto mt-2 max-h-32 overflow-y-auto">
                            {acceptedCuts.map((cut, index) => (
                              <div key={index} className="mb-1">
                                Cut {index + 1}: {cut.start.toFixed(2)}s - {cut.end.toFixed(2)}s
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {previewCuts.length > 0 && (
                        <div className="mt-4">
                          <label className="text-slate-400 text-sm">Preview Cuts Details</label>
                          <div className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto mt-2 max-h-32 overflow-y-auto">
                            {previewCuts.map((cut, index) => (
                              <div key={index} className="mb-1">
                                Preview {index + 1}: {cut.start.toFixed(2)}s - {cut.end.toFixed(2)}s
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Probe Data */}
                {probe && (
                  <div className="bg-slate-800 rounded-lg border border-slate-700">
                    <button
                      onClick={() => toggleSection('probe-data')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">FFmpeg Probe Data</h3>
                      </div>
                      {expandedSections.has('probe-data') ? 
                        <ChevronDown className="w-5 h-5 text-slate-400" /> : 
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      }
                    </button>
                    {expandedSections.has('probe-data') && (
                      <div className="px-4 pb-4 border-t border-slate-700">
                        <pre className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto mt-4">
                          {JSON.stringify(probe, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    Performance Metrics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {performanceMetrics.slice(-10).map((metric, index) => (
                      <div key={index} className="bg-slate-900 p-3 rounded">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 text-sm">{metric.name}</span>
                          <span className="text-white font-mono text-sm">
                            {metric.value} {metric.unit}
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs mt-1">
                          {formatTimestamp(metric.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Network className="w-5 h-5 text-orange-400" />
                    Network Requests
                  </h3>
                  {networkRequests.length === 0 ? (
                    <div className="text-slate-500 text-center py-8">
                      No network requests recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {networkRequests.map((request) => (
                        <div key={request.id} className="bg-slate-900 p-3 rounded">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs rounded ${
                                request.status && request.status >= 200 && request.status < 300
                                  ? 'bg-green-900 text-green-300'
                                  : request.status && request.status >= 400
                                  ? 'bg-red-900 text-red-300'
                                  : 'bg-yellow-900 text-yellow-300'
                              }`}>
                                {request.method}
                              </span>
                              <span className="text-white text-sm font-mono">
                                {request.url}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                              {request.status && (
                                <span>{request.status}</span>
                              )}
                              {request.duration && (
                                <span>{request.duration}ms</span>
                              )}
                              <span>{formatTimestamp(request.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
