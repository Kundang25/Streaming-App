import React, { useState, useEffect, useRef } from 'react';
import { useRoom } from '../context/RoomContext';
import { Play, Pause, Search, SkipForward, Maximize2 } from 'lucide-react';

const PlaybackControls: React.FC = () => {
  const {
    role,
    playbackState,
    queue,
    emitPlay,
    emitPause,
    emitSeek,
    emitChangeVideo,
    emitAddToQueue,
    emitSkipVideo,
    playerRef
  } = useRoom();

  const [videoInput, setVideoInput] = useState('');
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Track slider dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  
  // Quality states
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('default');

  const progressInterval = useRef<any>(null);
  const isHostOrMod = role === 'HOST' || role === 'MODERATOR';

  // Helper: Extract 11-char YouTube ID from URL or return string
  const extractVideoId = (input: string): string => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = input.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : input;
    return id.trim();
  };

  const handleQueueVideo = (e: React.MouseEvent, playNow: boolean) => {
    e.preventDefault();
    if (!videoInput.trim()) return;

    const videoId = extractVideoId(videoInput);
    if (videoId.length !== 11) {
      alert('Invalid YouTube Video ID/URL. Please check and try again.');
      return;
    }

    if (playNow) {
      emitChangeVideo(videoId);
    } else {
      emitAddToQueue(videoId, `Video (${videoId})`);
    }
    setVideoInput('');
  };

  // Poll player current time, duration, and local quality options
  useEffect(() => {
    progressInterval.current = setInterval(() => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === 'function' && !isDragging) {
        setLocalTime(player.getCurrentTime());
        setDuration(player.getDuration() || 0);

        // Fetch local video quality settings if available
        if (typeof player.getAvailableQualityLevels === 'function' && availableQualities.length === 0) {
          const levels = player.getAvailableQualityLevels();
          if (levels && levels.length > 0) {
            setAvailableQualities(levels);
            setSelectedQuality(player.getPlaybackQuality() || 'default');
          }
        }
      }
    }, 500);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [playerRef, isDragging, availableQualities]);

  // Sync state changes from server
  useEffect(() => {
    if (!isDragging) {
      setLocalTime(playbackState.currentTime);
    }
  }, [playbackState.currentTime, isDragging]);

  // Reset quality options when videoId changes
  useEffect(() => {
    setAvailableQualities([]);
    setSelectedQuality('default');
  }, [playbackState.videoId]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDragging(true);
    setDragValue(Number(e.target.value));
  };

  const handleSliderRelease = () => {
    setIsDragging(false);
    emitSeek(dragValue);
    setLocalTime(dragValue);
  };

  const handleFullscreen = () => {
    const wrapper = document.getElementById('watch-party-player-wrapper');
    if (wrapper) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        wrapper.requestFullscreen().catch((err) => {
          console.error('[Fullscreen] Failed to request fullscreen:', err);
        });
      }
    }
  };

  // Format seconds as MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const paddedS = s < 10 ? `0${s}` : s;
    if (hrs > 0) {
      const paddedM = mins < 10 ? `0${mins}` : mins;
      return `${hrs}:${paddedM}:${paddedS}`;
    }
    return `${mins}:${paddedS}`;
  };

  const timeVal = isDragging ? dragValue : localTime;

  return (
    <div style={styles.controlsGrid}>
      {/* 1. Playback Controls Bar */}
      <div style={styles.playbackRow}>
        {/* Play/Pause */}
        <div className="tooltip-container">
          <button
            className="btn btn-secondary"
            disabled={!isHostOrMod}
            onClick={playbackState.isPlaying ? emitPause : emitPlay}
            style={styles.controlBtn}
          >
            {playbackState.isPlaying ? <Pause size={15} fill="#FFF" /> : <Play size={15} fill="#FFF" />}
          </button>
          {!isHostOrMod && (
            <span className="tooltip-text">Only the Host or a Moderator can control playback.</span>
          )}
        </div>

        {/* Backward 10s */}
        <div className="tooltip-container">
          <button
            className="btn btn-secondary"
            disabled={!isHostOrMod}
            onClick={() => {
              if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                const newTime = Math.max(0, playerRef.current.getCurrentTime() - 10);
                emitSeek(newTime);
                setLocalTime(newTime);
              }
            }}
            style={styles.controlBtn}
          >
            <span style={{ fontSize: '10px', fontWeight: 800 }}>-10s</span>
          </button>
          {!isHostOrMod && (
            <span className="tooltip-text">Only the Host or a Moderator can seek playback.</span>
          )}
        </div>

        {/* Forward 10s */}
        <div className="tooltip-container">
          <button
            className="btn btn-secondary"
            disabled={!isHostOrMod}
            onClick={() => {
              if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                const newTime = Math.min(duration, playerRef.current.getCurrentTime() + 10);
                emitSeek(newTime);
                setLocalTime(newTime);
              }
            }}
            style={styles.controlBtn}
          >
            <span style={{ fontSize: '10px', fontWeight: 800 }}>+10s</span>
          </button>
          {!isHostOrMod && (
            <span className="tooltip-text">Only the Host or a Moderator can seek playback.</span>
          )}
        </div>

        {/* Skip to Next Video */}
        <div className="tooltip-container">
          <button
            className="btn btn-secondary"
            disabled={!isHostOrMod || queue.length === 0}
            onClick={emitSkipVideo}
            style={styles.controlBtn}
          >
            <SkipForward size={14} fill={isHostOrMod && queue.length > 0 ? '#FFF' : 'none'} />
          </button>
          {!isHostOrMod ? (
            <span className="tooltip-text">Only the Host or a Moderator can skip videos.</span>
          ) : queue.length === 0 ? (
            <span className="tooltip-text">Queue is empty. Add videos below.</span>
          ) : null}
        </div>

        {/* Progress Slider */}
        <div style={styles.sliderContainer} className="tooltip-container">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={timeVal}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            disabled={!isHostOrMod}
            style={styles.rangeInput}
          />
          {!isHostOrMod && (
            <span className="tooltip-text">Only the Host or a Moderator can seek playback.</span>
          )}
        </div>

        {/* Time Ticker */}
        <div style={styles.timeLabel}>
          {formatTime(timeVal)} / {formatTime(duration)}
        </div>

        {/* Video Quality settings selector (Local Client) */}
        {availableQualities.length > 0 && (
          <div style={styles.qualityContainer}>
            <select
              value={selectedQuality}
              onChange={(e) => {
                const q = e.target.value;
                setSelectedQuality(q);
                if (playerRef.current && typeof playerRef.current.setPlaybackQuality === 'function') {
                  playerRef.current.setPlaybackQuality(q);
                }
              }}
              style={styles.qualitySelect}
            >
              {availableQualities.map((q) => (
                <option key={q} value={q}>
                  {q === 'default' ? 'Auto' : q.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Fullscreen Button */}
        <button
          className="btn btn-secondary"
          onClick={handleFullscreen}
          style={styles.controlBtn}
          title="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* 2. Video Changer/Queue Form */}
      <form onSubmit={(e) => e.preventDefault()} style={styles.queueForm}>
        <div style={{ flexGrow: 1, position: 'relative' }} className="tooltip-container">
          <input
            type="text"
            placeholder="Paste YouTube video link or 11-char ID..."
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            disabled={!isHostOrMod}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={16} color="#9CA3AF" style={styles.searchIcon} />
          {!isHostOrMod && (
            <span className="tooltip-text">Only the Host or a Moderator can change or queue videos.</span>
          )}
        </div>
        
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!isHostOrMod || !videoInput.trim()}
          onClick={(e) => handleQueueVideo(e, true)}
          style={styles.actionBtn}
        >
          Play Now
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!isHostOrMod || !videoInput.trim()}
          onClick={(e) => handleQueueVideo(e, false)}
          style={styles.actionBtn}
        >
          Add to Queue
        </button>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  controlsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%'
  },
  playbackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%'
  },
  controlBtn: {
    width: '36px',
    height: '36px',
    padding: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  sliderContainer: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center'
  },
  rangeInput: {
    width: '100%',
    cursor: 'pointer',
    accentColor: '#8B5CF6'
  },
  timeLabel: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#9CA3AF',
    width: '95px',
    textAlign: 'center',
    flexShrink: 0
  },
  qualityContainer: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0
  },
  qualitySelect: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#FFF',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 8px',
    height: '34px',
    cursor: 'pointer',
    outline: 'none'
  },
  queueForm: {
    display: 'flex',
    gap: '10px',
    width: '100%'
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none'
  },
  actionBtn: {
    fontSize: '12px',
    padding: '0 16px',
    height: '44px',
    fontWeight: 600,
    flexShrink: 0
  }
};

export default PlaybackControls;
