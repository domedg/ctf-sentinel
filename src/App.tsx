/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { Terminal, Shield, Zap, Search, Code, Cpu, Network, AlertTriangle, ChevronRight, Loader2, Plus, MessageSquare, Menu, X, Download, Server, Trash2, Edit2, FileText, ExternalLink, EyeOff, Eye, TerminalSquare, Copy, Check, PenTool } from 'lucide-react';
import { cn } from './lib/utils';

const USER_PERSONA = `Ruolo e Obiettivo
Sei un Senior Security Researcher e un maestro di CTF (Capture The Flag). Il tuo obiettivo è assistere l'utente nella risoluzione di challenge di cybersecurity (Web, Crypto, Pwn, Reverse, Forensics, OSINT). Il tuo tono deve essere professionale, elegante, analitico e in linea con un ambiente "hacker" serio: niente cliché cinematografici, solo precisione tecnica e pragmatismo.

Base di Conoscenza (fomita di seguito):
Devi attingere primariamente dalle conoscenze fornite nel contesto, contenente metodologie e writeup di challenge passate. Usa queste informazioni per dedurre pattern di risoluzione.

FORMATTAZIONE OUTPUT OBBLIGATORIA:
Devi strutturare OGNI TUA SINGOLA RISPOSTA seguendo rigorosamente queste tre sezioni esatte (usa questi titoli in Markdown):

### [ANALISI]
Spiega in modo conciso cosa hai dedotto dai file forniti, dai log o dalla richiesta dell'utente. Identifica vulnerabilità o vettori d'attacco potenziali.

### [RAGIONAMENTO]
Descrivi il processo logico per arrivare alla soluzione. 
ATTENZIONE: Se hai bisogno di ulteriori informazioni o output di comandi prima di poter scrivere l'exploit, FERMATI QUI e poni la domanda all'utente. Non inventare dati inesistenti.

### [EXPLOIT FINALE]
Fornisci ESCLUSIVAMENTE script Python puliti (es. pwntools, requests) o comandi Bash netti e pronti all'uso. NON usare spiegazioni per "cliccare su bottoni" o interfacce grafiche. Commenta il codice in modo professionale.`;

interface FileContext {
  name: string;
  type: string;
  content: string;
  isBinary: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: FileContext[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([{ id: 'default', title: 'New Analysis', messages: [] }]);
  const [currentSessionId, setCurrentSessionId] = useState('default');
  const [knowledgeBase, setKnowledgeBase] = useState('');
  
  const [flags, setFlags] = useState<string[]>([]);
  const [showBootSequence, setShowBootSequence] = useState(true);
  const [bootLines, setBootLines] = useState<string[]>([]);
  
  const [showTools, setShowTools] = useState(false);
  const [toolInput, setToolInput] = useState('');
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileContext[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChatList, setShowChatList] = useState(true);
  const [externalTools, setExternalTools] = useState<{name: string, url: string}[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isGeneratingWriteup, setIsGeneratingWriteup] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId)!;

  useEffect(() => {
    if (!showBootSequence) return;
    const lines = [
      "Loading kernel modules...",
      "Mounting /dev/nvme...",
      "Initializing secure enclave...",
      "Loading CTF context matrices...",
      "Handshake with C2 server established.",
      "ACCESS GRANTED."
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        // avoid stale closures
        setBootLines(prev => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowBootSequence(false), 800);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [showBootSequence]);

  useEffect(() => {
    // Load local knowledge base built by scripts/build-knowledge.js
    fetch('/knowledge.txt')
      .then(res => res.text())
      .then(text => {
        if (!text.startsWith('<!DOCTYPE html')) {
          setKnowledgeBase(text);
        }
      })
      .catch(err => console.warn('Knowledge base not found (run build script)', err));

    // Fetch external tools
    fetch('/api/tools')
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data) && data.length > 0) {
            setExternalTools(data);
         }
      }).catch(err => console.warn('Tools fetch failed', err));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession.messages]);

  const handleCreateSession = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setSessions(prev => [{ id: newId, title: 'New Analysis', messages: [] }, ...prev]);
    setCurrentSessionId(newId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const updateSessionMessages = (newMessages: Message[]) => {
    // Extract flags from the new messages
    const allText = newMessages.map(m => m.content).join('\\n');
    const foundFlags = allText.match(/\\b([a-zA-Z0-9_]+)\\{[^\\}]+\\}/g) || [];
    if (foundFlags.length > 0) {
       setFlags(prev => Array.from(new Set([...prev, ...foundFlags])));
    }

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        // Auto-generate title if this is the first user message
        let title = s.title;
        if (s.messages.length === 0 && newMessages.length > 0) {
          const firstMsg = newMessages[0].content;
          title = firstMsg.length > 25 ? firstMsg.substring(0, 25) + "..." : firstMsg;
        }
        return { ...s, title, messages: newMessages };
      }
      return s;
    }));
  };

  const generateWriteup = async () => {
    if (currentSession.messages.length === 0) return;
    setIsGeneratingWriteup(true);
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in .env.local");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const historyContents = currentSession.messages.map(msg => {
          let text = msg.content;
          if (msg.files && msg.files.length > 0) {
             const fBlock = msg.files.map(f => `Name: ${f.name}\n${f.content.substring(0, 1500)}...`).join('\n\n---\n\n');
             text = `[CONTEXT/FILE]\n${fBlock}\n\n[USER QUERY]\n${text}`;
          }
          return {
             role: msg.role === 'user' ? 'user' : 'model',
             parts: [{ text }]
          };
      });

      historyContents.push({
        role: 'user',
        parts: [{ text: "COMPITO CRITICO: Sei un hacker professionista. Genera un WRITEUP FINALE perfetto, formattato in Markdown eccellente, basato solo su questa conversazione. Non deve sembrare una chat, ma un documento formale. Includi rigorosamente i seguenti H2:\n\n# CTF Writeup: [Titolo Creativo]\n\n## 1. Overview\nRiassunto rapido scenario/obiettivo.\n\n## 2. Analisi e Vulnerabilità\nDettaglio sulle analisi effettuate (recon) e falla tecnica scoperta.\n\n## 3. Strategia di Attacco\nProcesso logico passo per passo della fase di exploit.\n\n## 4. Codice dell'Exploit\nSe rilevante, inserisci i payload, gli script Python finali o la sequenza comandi usata, in code blocks ben annotati.\n\n## 5. Conclusioni e Flag\nEsito finale, riflessioni finali ed esponi graficamente la Flag se recuperata in conversazione.\n\nNon usare convenevoli, stampa solo il file Markdown puro, no frills." }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: historyContents as any,
        config: { temperature: 0.2 },
      });

      const writeupText = response.text || "Errore nella generazione del writeup.";
      
      // Save locally via secure backend
      const saveRes = await fetch('/api/writeup', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            title: currentSession.title,
            content: writeupText
         })
      });

      if (saveRes.ok) {
         const blob = new Blob([writeupText], { type: 'text/markdown' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `Writeup_${currentSession.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
         a.click();
         URL.revokeObjectURL(url);
         alert("SYSTEM: Writeup Generato con Successo! Salvato nella directory /Writeups/ del Workspace.");
      } else {
         alert("SYSTEM: Errore nel salvataggio su disco del writeup. Assicurati che il backend sia attivo.");
      }
    } catch (e: any) {
      console.error(e);
      alert("SYSTEM CRITICAL: " + (e.message || String(e)));
    } finally {
      setIsGeneratingWriteup(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessions.length === 1) return; // Prevent deleting the last session
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(sessions.find(s => s.id !== id)!.id);
    }
  };

  const renameSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTitle = prompt("Enter new title for the operation:");
    if (newTitle && newTitle.trim()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle.trim() } : s));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newContexts: FileContext[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isBinary = !file.name.match(/\\.(c|cpp|txt|md|py|asm|h|json|jsx|tsx|css|html|xml|yaml)$/i);
      
      if (isBinary) {
        try {
          const response = await fetch('/api/recon', {
            method: 'POST',
            headers: {
              'x-file-name': file.name
            },
            body: file
          });
          
          if (!response.ok) throw new Error('API Rejection');
          
          let reconOutput = await response.text();
          
          // Limit to avoid token overflow
          if (reconOutput.length > 60000) {
             reconOutput = reconOutput.substring(0, 60000) + "\n\n...[OUTPUT TRUNCATO DAL SENTINEL PER LIMITE TOKEN]...";
          }

          newContexts.push({ 
            name: file.name, 
            type: file.type || 'application/octet-stream', 
            content: `[RECON AUTOMATICA (Utils/recon.py)]\n${reconOutput}`, 
            isBinary: true 
          });
        } catch (err) {
          console.error("Recon pass failed, fallback:", err);
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let hexDump = "";
          const limit = Math.min(uint8Array.length, 4096);
          for (let j = 0; j < limit; j += 16) {
            const chunk = uint8Array.slice(j, j + 16);
            const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
            hexDump += `${j.toString(16).padStart(8, '0')}: ${hex.padEnd(48)}  |${ascii}|\n`;
          }
          newContexts.push({ name: file.name, type: file.type || 'application/octet-stream', content: `HEX DUMP (First 4KB):\n${hexDump}`, isBinary: true });
        }
      } else {
        if (file.size > 300000) {
          alert(`File limit exceeded for ${file.name} (300KB max for text files).`);
          continue;
        }
        const text = await file.text();
        newContexts.push({ name: file.name, type: file.type || 'text/plain', content: text, isBinary: false });
      }
    }
    
    setSelectedFiles(prev => [...prev, ...newContexts]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const handleAnalyze = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || (selectedFiles.length > 0 ? `Analyzing files: ${selectedFiles.map(f => f.name).join(', ')}` : ''),
      timestamp: new Date(),
      files: selectedFiles.length > 0 ? selectedFiles : undefined
    };

    const newMessages = [...currentSession.messages, userMessage];
    updateSessionMessages(newMessages);
    setInput('');
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY in .env.local");
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let promptText = userMessage.content;
      
      if (userMessage.files && userMessage.files.length > 0) {
        const filesBlock = userMessage.files.map(f => `Name: ${f.name}\nIsBinary: ${f.isBinary}\nContent:\n${f.content}`).join('\n\n---\n\n');
        promptText = `[ATTACHED FILES OR CONTEXT]\n${filesBlock}\n\n[USER REQUEST]\n${userMessage.content}`;
      }

      const historyContents = currentSession.messages.map((msg, index) => {
        // Build a text payload for previous interactions
        let text = msg.content;
        if (msg.files && msg.files.length > 0) {
           const fBlock = msg.files.map(f => `Name: ${f.name}\n${f.content}`).join('\n\n---\n\n');
           text = `[ATTACHED FILES]\n${fBlock}\n\n[QUERY]\n${text}`;
        }
        
        // Inject knowledge base into the very first message
        if (index === 0 && knowledgeBase) {
           text = `[KNOWLEDGE BASE CONTEXT]\n${knowledgeBase}\n\n[USER QUERY]\n${text}`;
        }
        
        return {
           role: msg.role === 'user' ? 'user' : 'model',
           parts: [{ text }]
        };
      });

      // Add the current prompt to history contents
      // If it's the very first message, inject the knowledge base here too
      if (currentSession.messages.length === 0 && knowledgeBase) {
         promptText = `[KNOWLEDGE BASE CONTEXT]\n${knowledgeBase}\n\n[USER QUERY]\n${promptText}`;
      }
      
      historyContents.push({
        role: 'user',
        parts: [{ text: promptText }]
      });

      const fullInstruction = `${USER_PERSONA}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: historyContents as any, // Simple mapping for the beta SDK
        config: {
          systemInstruction: fullInstruction,
          temperature: 0.2, // Low temp for more precise/hacker tone
        },
      });

      updateSessionMessages([...newMessages, {
        role: 'assistant',
        content: response.text || "Analysis failed. No output generated.",
        timestamp: new Date(),
      }]);
    } catch (error: any) {
      console.error("Analysis Error:", error);
      updateSessionMessages([...newMessages, {
        role: 'assistant',
        content: `## Error\nCritical failure in analysis engine.\n\`\`\`text\n${error.message || 'Unknown network/API error.'}\n\`\`\``,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      // Focus input again on desktop
      if (window.innerWidth >= 768) {
         setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  if (showBootSequence) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex flex-col p-8 font-mono text-green-500 overflow-hidden text-sm">
        {bootLines.map((line, idx) => (
          <div key={idx} className="mb-1 animate-in fade-in duration-200">
            <span className="opacity-50 mr-4">[{new Date().toISOString().split('T')[1].substring(0,8)}]</span>
            {line}
          </div>
        ))}
        <div className="w-2.5 h-4 bg-green-500 animate-pulse mt-1" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-zinc-950 flex font-mono text-zinc-300 selection:bg-green-500/30 selection:text-green-100 overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed md:relative flex flex-col h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-30 shadow-2xl flex-shrink-0",
        sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0 w-0 hidden md:flex",
        !sidebarOpen && "md:w-0 md:opacity-0 md:overflow-hidden"
      )}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/10 p-2 rounded-lg border border-green-500/20 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-green-50 uppercase">CTF Sentinel</h1>
              <p className="text-[9px] text-green-400/60 uppercase tracking-widest mt-0.5.">SecOps Interface</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <button 
            onClick={handleCreateSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 font-medium text-xs uppercase tracking-wider rounded-md transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" /> New Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 pb-20">
          
          {/* Active Ops Section */}
          <div className="flex items-center justify-between px-2 py-2 mt-2">
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Active Ops</p>
            <button onClick={() => setShowChatList(!showChatList)} className="text-zinc-500 hover:text-zinc-300 transition-colors" title={showChatList ? "Hide ops list" : "Show ops list"}>
               {showChatList ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          
          {showChatList && sessions.map(s => (
            <div key={s.id} className="relative group animate-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => { setCurrentSessionId(s.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-md text-left text-sm transition-all",
                  currentSessionId === s.id 
                    ? "bg-zinc-800 text-green-100 shadow-inner" 
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                )}
              >
                <MessageSquare className={cn("w-4 h-4 flex-shrink-0", currentSessionId === s.id ? "text-green-500" : "text-zinc-600")} />
                <span className="truncate flex-1 pr-12">{s.title}</span>
              </button>
              {sessions.length > 1 && (
                <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-zinc-800 via-zinc-800 to-transparent pl-4">
                  <button onClick={(e) => renameSession(e, s.id)} className="p-1.5 text-zinc-400 hover:text-green-400 rounded-md hover:bg-zinc-700/80 transition-colors" title="Rename Op">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => deleteSession(e, s.id)} className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md hover:bg-zinc-700/80 transition-colors" title="Abort Op">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* External Tools Section */}
          {externalTools.length > 0 && (
             <div className="mt-6">
                <p className="text-[10px] text-zinc-500 px-2 py-2 font-medium uppercase tracking-widest flex items-center gap-2">
                   <Network className="w-3 h-3" /> Cyber Bookmarks
                </p>
                <div className="space-y-0.5 mt-1">
                   {externalTools.map((t, i) => (
                      <a key={i} href={t.url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-xs text-zinc-400 hover:bg-zinc-800/40 hover:text-green-300 transition-colors group">
                        <span className="truncate">{t.name}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                   ))}
                </div>
             </div>
          )}
          
          <div className="mt-6 mb-2">
            <p className="text-[10px] text-zinc-500 px-2 py-2 font-medium uppercase tracking-widest">Flags Captured</p>
            <div className="px-2 space-y-2">
              {flags.length === 0 ? (
                <div className="text-[11px] text-zinc-600 italic">No flags intercepted yet.</div>
              ) : (
                 flags.map((f, i) => (
                   <div key={i} className="text-xs bg-green-500/10 border border-green-500/30 text-green-300 p-2 rounded-md break-all font-sans">
                     🚀 {f}
                   </div>
                 ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> KB SIZE</span>
            <span className={knowledgeBase.length > 0 ? "text-green-400" : "text-yellow-500"}>
              {knowledgeBase.length > 0 ? (knowledgeBase.length / 1024).toFixed(1) + ' KB' : 'Missing'}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowTools(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-green-400 text-[10px] uppercase font-bold tracking-widest rounded transition-colors border border-zinc-700 shadow-sm">
              <Server className="w-3 h-3" /> CyberTools
            </button>
            <button onClick={generateWriteup} disabled={isGeneratingWriteup} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-green-400 text-[10px] uppercase font-bold tracking-widest rounded transition-colors border border-zinc-700 shadow-sm disabled:opacity-50">
              {isGeneratingWriteup ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenTool className="w-3 h-3" />} Writeup
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative w-full">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-zinc-400 hover:text-green-400 transition-colors p-1">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
              <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">Session: <span className="text-green-400/80">{currentSession.id}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-zinc-500">
             <span className="hidden sm:inline-flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> Engine: Gem-3.1</span>
          </div>
        </header>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
          {currentSession.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-70 animate-in fade-in duration-700">
              <div className="relative mb-6">
                 <Cpu className="w-20 h-20 text-zinc-800" />
                 <AlertTriangle className="w-6 h-6 text-yellow-500/80 absolute -bottom-1 -right-1 animate-pulse" />
              </div>
              <h2 className="text-lg text-green-100 font-bold mb-2 uppercase tracking-wide">Sentinel Standby</h2>
              <p className="max-w-md text-sm text-zinc-500 leading-relaxed">
                Senior Security Researcher loaded. Context methodologies synchronized.<br />
                Awaiting mission parameters, PCAP files, or source code for analysis.
              </p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                <button onClick={() => setInput("How can I extract data from a blind SQL injection? Provide a python pwntools script.")}
                  className="p-3 text-left border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-green-500/30 rounded-lg text-xs transition-all flex flex-col gap-1 group">
                  <span className="text-green-400 font-medium uppercase tracking-wider group-hover:text-green-300">Methodology</span>
                  <span className="text-zinc-500">Blind SQL Injection automation</span>
                </button>
                <button onClick={() => setInput("Checksec reports: No Canary, No PIE, NX Enabled. How do I construct a ROP chain?")}
                  className="p-3 text-left border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-green-500/30 rounded-lg text-xs transition-all flex flex-col gap-1 group">
                  <span className="text-green-400 font-medium uppercase tracking-wider group-hover:text-green-300">Exploitation</span>
                  <span className="text-zinc-500">Basic ROP Chain strategy</span>
                </button>
              </div>
            </div>
          )}

          {currentSession.messages.map((msg, idx) => (
            <div key={idx} className={cn(
              "flex flex-col space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-4xl mx-auto w-full",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest px-1">
                <span className={msg.role === 'user' ? "text-zinc-400" : "text-green-500 font-semibold"}>
                  {msg.role === 'user' ? 'Operator' : 'Sentinel'}
                </span>
                <span>•</span>
                <span>{msg.timestamp.toLocaleTimeString()}</span>
              </div>
              
              <div className={cn(
                "p-4 rounded-xl shadow-sm text-sm w-full sm:max-w-[85%] border",
                msg.role === 'user' 
                  ? "bg-zinc-900 border-zinc-800 text-zinc-300" // User style
                  : "bg-zinc-950 border-green-500/20 text-zinc-300 shadow-[0_4px_20px_rgba(20,184,166,0.03)]" // Assistant style
              )}>
                {msg.files && msg.files.length > 0 && (
                  <div className="mb-4 grid gap-2">
                    {msg.files.map((f, i) => (
                      <div key={i} className="p-3 border border-zinc-800 bg-zinc-950 rounded-lg flex items-center gap-3 shadow-sm">
                        <div className="bg-zinc-800 p-2 rounded-md">
                          {f.isBinary ? <Cpu className="w-4 h-4 text-green-400" /> : <Code className="w-4 h-4 text-green-400" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-semibold text-zinc-200 truncate">{f.name}</div>
                          <div className="text-[10px] text-zinc-500 uppercase">{f.type}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {msg.role === 'user' ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                ) : (
                  <div className="markdown-body prose prose-invert prose-green max-w-none text-[15px] leading-relaxed">
                    <Markdown components={{
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        if (!inline && match) {
                          const codeString = String(children).replace(/\n$/, '');
                          const language = match[1];
                          const isPython = language === 'python';
                          const isBash = language === 'bash' || language === 'sh';
                          
                          const handleCopy = () => {
                             navigator.clipboard.writeText(codeString);
                             setCopiedCode(codeString);
                             setTimeout(() => setCopiedCode(null), 2000);
                          };
                          
                          const handleDownload = () => {
                            const blob = new Blob([codeString], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `exploit.${isPython ? 'py' : isBash ? 'sh' : 'txt'}`;
                            a.click();
                            URL.revokeObjectURL(url);
                          };
                          
                          return (
                            <div className="exploit-box group/code">
                              <div className="exploit-header">
                                <div className="flex items-center gap-2">
                                  <TerminalSquare className="w-4 h-4 text-green-500" />
                                  <span className="text-zinc-300 font-mono uppercase tracking-widest">{language}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={handleCopy} className="p-1.5 text-zinc-400 hover:text-white rounded transition-colors" title="Copy to clipboard">
                                    {copiedCode === codeString ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={handleDownload} className="p-1.5 text-zinc-400 hover:text-white rounded transition-colors" title="Download Script">
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="exploit-body bg-black">
                                <code className={className} {...props}>{children}</code>
                              </div>
                            </div>
                          );
                        }
                        return <code className={className} {...props}>{children}</code>;
                      }
                    }}>{msg.content}</Markdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start space-y-2 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 text-[10px] text-green-500 uppercase tracking-widest ml-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Analyzing vectors...
              </div>
              <div className="p-4 rounded-xl border border-green-500/10 bg-zinc-900/30 sm:max-w-[85%] h-16 flex items-center justify-center">
                 <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" />
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800">
          <div className="max-w-4xl mx-auto relative group flex items-end gap-2">
            
            {/* Upload Button */}
            <div className="relative pb-[5px]">
              <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-green-500/50 text-zinc-400 hover:text-green-400 transition-all shadow-sm"
                title="Attach Context (Code, Binary, PCAP)"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Input Box */}
            <div className="flex-1 relative">
               {selectedFiles.length > 0 && (
                  <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 max-h-32 overflow-y-auto p-2 bg-green-950/80 backdrop-blur-md border border-green-500/30 rounded-lg flex flex-col gap-1 text-xs animate-in slide-in-from-bottom-1 z-10 scrollbar-thin">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-green-500 text-[10px] uppercase tracking-wider">Payloads ({selectedFiles.length})</span>
                      <button onClick={() => setSelectedFiles([])} className="text-zinc-400 hover:text-red-400 transition-colors p-1" title="Clear all">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex justify-between items-center bg-zinc-900/60 p-1.5 rounded border border-zinc-800">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          <span className="font-mono text-green-100 truncate">{file.name}</span>
                        </div>
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-red-400 transition-colors px-2">
                           <X className="w-3 h-3" />
                         </button>
                      </div>
                    ))}
                  </div>
                )}
                
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter objective or provide target data..."
                className="w-full bg-zinc-900 border border-zinc-800 p-3.5 pr-14 rounded-xl focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 resize-none min-h-[50px] max-h-[250px] font-sans text-sm text-zinc-200 placeholder:text-zinc-600 shadow-inner transition-all leading-tight scrollbar-thin scrollbar-thumb-zinc-800"
                rows={Math.min(5, Math.max(1, input.split('\n').length))}
              />
              
              <button
                onClick={handleAnalyze}
                disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
                className={cn(
                  "absolute right-2 bottom-[9px] h-8 w-8 rounded-md flex items-center justify-center transition-all",
                  isLoading || (!input.trim() && selectedFiles.length === 0)
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                    : "bg-green-500 text-green-950 hover:bg-green-400 hover:shadow-[0_0_15px_rgba(20,184,166,0.4)]"
                )}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
            
          </div>
          <div className="max-w-4xl mx-auto mt-2 text-center">
            <span className="text-[9px] text-zinc-600 uppercase tracking-widest">
              Shift + Enter for new line. Sentinel uses AI to formulate attack vectors.
            </span>
          </div>
        </div>
      </main>

      {/* Cyber Tools Modal */}
      {showTools && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-green-500/30 rounded-xl w-full max-w-2xl shadow-[0_0_50px_rgba(34,197,94,0.1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-green-50 tracking-wider">CYBER-TOOLS <span className="text-[10px] text-zinc-500 uppercase ml-2">Local Execution</span></h3>
              </div>
              <button onClick={() => setShowTools(false)} className="text-zinc-500 hover:text-red-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <textarea 
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                placeholder="Paste payload here..."
                className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm font-mono text-zinc-300 focus:outline-none focus:border-green-500/50 resize-none scrollbar-thin scrollbar-thumb-zinc-800"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { try { setToolInput(atob(toolInput)) } catch(e) { alert('Invalid Base64') } }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-zinc-700 text-green-400 transition-colors font-semibold">Base64 Decode</button>
                <button onClick={() => setToolInput(btoa(toolInput))} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-zinc-700 text-zinc-300 transition-colors">Base64 Encode</button>
                <button onClick={() => {
                  try {
                    const hex = toolInput.replace(/\s/g, '');
                    let str = '';
                    for (let i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                    setToolInput(str);
                  } catch(e) { alert('Invalid Hex') }
                }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-zinc-700 text-green-400 transition-colors font-semibold">Hex Decode</button>
                <button onClick={() => {
                  setToolInput(Array.from(toolInput).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
                }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-zinc-700 text-zinc-300 transition-colors">Hex Encode</button>
                <button onClick={() => {
                  setToolInput(toolInput.replace(/[a-zA-Z]/g, c => {
                    let code = c.charCodeAt(0) + 13;
                    if (code > (c <= 'Z' ? 90 : 122)) code -= 26;
                    return String.fromCharCode(code);
                  }));
                }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-zinc-700 text-green-400 transition-colors">ROT13</button>
                <button onClick={() => {
                   setToolInput(decodeURIComponent(toolInput));
                }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-zinc-700 text-green-400 transition-colors font-semibold">URL Decode</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
