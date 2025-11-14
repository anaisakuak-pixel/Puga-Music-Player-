
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Track, RepeatMode } from './types';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPreviousIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon, VolumeHighIcon, VolumeMuteIcon, MusicNoteIcon, UploadIcon } from './components/Icons';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const setupAudioContext = () => {
    if (!audioContext && audioRef.current) {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = context.createMediaElementSource(audioRef.current);
        const analyser = context.createAnalyser();
        
        source.connect(analyser);
        analyser.connect(context.destination);

        setAudioContext(context);
        setAnalyserNode(analyser);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newTracks: Track[] = Array.from(files)
        // FIX: Explicitly type `file` as `File` to resolve properties like `type`, `name`, and `size`.
        .filter((file: File) => file.type.startsWith('audio/'))
        .map((file: File) => ({
          id: `${file.name}-${file.size}-${Date.now()}`,
          url: URL.createObjectURL(file),
          title: file.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
        }));
      setTracks(prevTracks => [...prevTracks, ...newTracks]);
      if (currentTrackIndex === null && newTracks.length > 0) {
        setCurrentTrackIndex(0);
      }
    }
  };

  const playTrack = useCallback((index: number) => {
    if (index >= 0 && index < tracks.length) {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
      if (audioRef.current) {
         audioRef.current.src = tracks[index].url;
         audioRef.current.load();
         audioRef.current.play().catch(error => console.error("Error playing audio:", error));
      }
    }
  }, [tracks]);
  
  const playNext = useCallback(() => {
    if (tracks.length === 0) return;
    
    if (repeatMode === 'one' && currentTrackIndex !== null) {
        playTrack(currentTrackIndex);
        return;
    }

    if (isShuffle) {
        const nextIndex = Math.floor(Math.random() * tracks.length);
        playTrack(nextIndex);
        return;
    }

    let nextIndex = (currentTrackIndex ?? -1) + 1;
    if (nextIndex >= tracks.length) {
        if (repeatMode === 'all') {
            nextIndex = 0;
        } else {
            setIsPlaying(false);
            setCurrentTrackIndex(null);
            return;
        }
    }
    playTrack(nextIndex);
  }, [currentTrackIndex, tracks.length, isShuffle, repeatMode, playTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const setAudioData = () => {
        setDuration(audio.duration);
        setProgress(audio.currentTime);
      };
      
      const handleTimeUpdate = () => setProgress(audio.currentTime);
      const handleEnded = () => playNext();

      audio.addEventListener('loadedmetadata', setAudioData);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);

      audio.volume = isMuted ? 0 : volume;

      return () => {
        audio.removeEventListener('loadedmetadata', setAudioData);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [volume, isMuted, playNext]);

  useEffect(() => {
    if (currentTrackIndex !== null && !audioRef.current?.src) {
        playTrack(currentTrackIndex);
    }
  }, [currentTrackIndex, playTrack]);
  
  const togglePlayPause = () => {
    if (!audioContext) {
      setupAudioContext();
    }

    if (currentTrackIndex === null && tracks.length > 0) {
      playTrack(0);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => console.error("Error playing audio:", error));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playPrev = () => {
    if (tracks.length === 0 || currentTrackIndex === null) return;
    const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    playTrack(prevIndex);
  };
  
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = Number(e.target.value);
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  const toggleRepeatMode = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;

  return (
    <div className="text-slate-200 min-h-screen flex flex-col bg-slate-900/70 backdrop-blur-xl">
      <Visualizer analyserNode={analyserNode} />
      <main className="flex-grow p-4 md:p-8 pb-32">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <MusicNoteIcon className="h-8 w-8 text-violet-400" />
            Gemini Player
          </h1>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            <UploadIcon className="w-5 h-5" />
            Add Songs
          </button>
          <input
            type="file"
            multiple
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </header>

        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full flex-grow mt-20 text-center">
            <MusicNoteIcon className="w-24 h-24 text-slate-600 mb-4" />
            <h2 className="text-2xl font-semibold text-slate-300">No songs in your library</h2>
            <p className="text-slate-400 mt-2">Click "Add Songs" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => playTrack(index)}
                className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  currentTrackIndex === index ? 'bg-violet-500/30' : 'hover:bg-slate-800'
                }`}
              >
                <div className="w-12 h-12 bg-slate-700 rounded-md flex items-center justify-center mr-4">
                  <MusicNoteIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div className="flex-grow">
                  <p className={`font-semibold ${currentTrackIndex === index ? 'text-violet-300' : 'text-slate-100'}`}>{track.title}</p>
                  <p className="text-sm text-slate-400">{track.artist}</p>
                </div>
                 {currentTrackIndex === index && isPlaying && (
                    <div className="flex space-x-1 items-center">
                        <span className="w-1 h-4 bg-violet-400 animate-[bounce_1.2s_ease-in-out_infinite] delay-0"></span>
                        <span className="w-1 h-5 bg-violet-400 animate-[bounce_1.2s_ease-in-out_infinite] delay-150"></span>
                        <span className="w-1 h-3 bg-violet-400 animate-[bounce_1.2s_ease-in-out_infinite] delay-300"></span>
                    </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/50 backdrop-blur-md border-t border-slate-700/50 p-4 z-50">
        <audio ref={audioRef} />
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="w-14 h-14 bg-slate-700 rounded-md flex items-center justify-center flex-shrink-0">
                <MusicNoteIcon className="w-8 h-8 text-slate-400"/>
             </div>
            <div>
              <p className="font-bold text-white truncate">{currentTrack?.title || 'No song selected'}</p>
              <p className="text-sm text-slate-400">{currentTrack?.artist || '...'}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsShuffle(!isShuffle)} className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-violet-400' : 'text-slate-400 hover:text-white'}`}>
                <ShuffleIcon className="w-5 h-5" />
              </button>
              <button onClick={playPrev} disabled={!currentTrack} className="p-2 rounded-full text-slate-300 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed">
                <SkipPreviousIcon className="w-7 h-7" />
              </button>
              <button onClick={togglePlayPause} disabled={!currentTrack} className="bg-white text-slate-900 p-3 rounded-full hover:bg-violet-300 disabled:bg-slate-600 disabled:cursor-not-allowed transition-transform transform hover:scale-105">
                {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
              </button>
              <button onClick={playNext} disabled={!currentTrack} className="p-2 rounded-full text-slate-300 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed">
                <SkipNextIcon className="w-7 h-7" />
              </button>
              <button onClick={toggleRepeatMode} className={`p-2 rounded-full transition-colors ${repeatMode !== 'off' ? 'text-violet-400' : 'text-slate-400 hover:text-white'}`}>
                {repeatMode === 'one' ? <RepeatOneIcon className="w-5 h-5" /> : <RepeatIcon className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex items-center gap-2 w-full mt-2">
              <span className="text-xs text-slate-400">{formatTime(progress)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={progress}
                onChange={handleProgressChange}
                disabled={!currentTrack}
                className="w-full h-1.5 accent-violet-400 disabled:opacity-50"
              />
              <span className="text-xs text-slate-400">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeMuteIcon className="w-6 h-6 text-slate-400 hover:text-white" /> : <VolumeHighIcon className="w-6 h-6 text-slate-400 hover:text-white" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-24 h-1.5 accent-violet-400"
            />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
