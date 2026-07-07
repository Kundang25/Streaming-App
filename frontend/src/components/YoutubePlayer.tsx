// import React, { useEffect } from 'react';
// import { useRoom } from '../context/RoomContext';
// import { Film } from 'lucide-react';

// const YoutubePlayer: React.FC = () => {
//   const { playbackState, playerRef, role, emitPlay, emitPause, reactions } = useRoom();

//   useEffect(() => {
//     let playerInstance: any = null;
//     const playerId = 'youtube-iframe-player';

//     const initializePlayer = () => {
//       // Check if YouTube API script is loaded and ready
//       if (!(window as any).YT || !(window as any).YT.Player) {
//         setTimeout(initializePlayer, 100);
//         return;
//       }

//       console.log('[Player] YT IFrame API is ready, constructing player...');
//       playerInstance = new (window as any).YT.Player(playerId, {
//         height: '100%',
//         width: '100%',
//         videoId: playbackState.videoId || '',
//         playerVars: {
//           autoplay: playbackState.isPlaying ? 1 : 0,
//           controls: 0,       // hide native YouTube controls
//           disablekb: 1,      // disable keyboard shortcuts
//           fs: 0,             // disable fullscreen button
//           modestbranding: 1, // hide YouTube logo watermark
//           rel: 0,            // disable related videos at end
//           origin: window.location.origin
//         },
//         events: {
//           onReady: (event: any) => {
//             console.log('[Player] Player instance ready');
//             playerRef.current = event.target;
            
//             // Sync initial state on load
//             if (playbackState.videoId) {
//               event.target.loadVideoById({
//                 videoId: playbackState.videoId,
//                 startSeconds: playbackState.currentTime
//               });
//               if (playbackState.isPlaying) {
//                 event.target.playVideo();
//               } else {
//                 event.target.pauseVideo();
//               }
//             }
//           },
//           onStateChange: (event: any) => {
//             // Revert state for non-hosts/mods or ignore feedback loops
//             if ((window as any).isSyncing) {
//               return;
//             }

//             const state = event.data;
//             const isHostOrMod = role === 'HOST' || role === 'MODERATOR';

//             if (!isHostOrMod) {
//               // Block unauthorized state changes (force pause/play back to synced state)
//               if (state === 1 && !playbackState.isPlaying) {
//                 event.target.pauseVideo();
//               } else if (state === 2 && playbackState.isPlaying) {
//                 event.target.playVideo();
//               }
//               return;
//             }

//             // Sync host state changes
//             if (state === 1 && !playbackState.isPlaying) {
//               emitPlay();
//             } else if (state === 2 && playbackState.isPlaying) {
//               emitPause();
//             }
//           }
//         }
//       });
//     };

//     initializePlayer();

//     return () => {
//       if (playerInstance && typeof playerInstance.destroy === 'function') {
//         console.log('[Player] Destroying YouTube player instance');
//         playerInstance.destroy();
//       }
//       playerRef.current = null;
//     };
//   }, []);

//   return (
//     <div id="watch-party-player-wrapper" style={styles.playerContainer}>
//       <div id="youtube-iframe-player" style={styles.iframe}></div>
      
//       {/* Floating Reactions Overlay */}
//       <div style={styles.reactionsOverlay}>
//         {reactions.map((r) => (
//           <span
//             key={r.id}
//             className="floating-reaction"
//             style={{
//               left: `${Math.random() * 80 + 10}%`,
//               bottom: '10px'
//             }}
//           >
//             {r.emoji}
//           </span>
//         ))}
//       </div>

//       {!playbackState.videoId && (
//         <div style={styles.placeholderOverlay}>
//           <Film size={48} color="#8B5CF6" style={{ filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))' }} />
//           <h3 style={{ marginTop: '16px', fontSize: '18px' }}>No video cued yet</h3>
//           <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '6px', maxWidth: '300px' }}>
//             Ask the Host or Moderator to paste a YouTube video ID or link in the bar below.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// };

// const styles: { [key: string]: React.CSSProperties } = {
//   playerContainer: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     width: '100%',
//     height: '100%',
//     background: '#000000'
//   },
//   iframe: {
//     width: '100%',
//     height: '100%'
//   },
//   placeholderOverlay: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     background: 'rgba(11, 10, 25, 0.95)',
//     display: 'flex',
//     flexDirection: 'column',
//     alignItems: 'center',
//     justifyContent: 'center',
//     color: '#FFFFFF',
//     textAlign: 'center',
//     padding: '20px',
//     zIndex: 5
//   },
//   reactionsOverlay: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     pointerEvents: 'none',
//     overflow: 'hidden',
//     zIndex: 10
//   }
// };

// export default YoutubePlayer;



import React, { useEffect, useRef } from 'react';
import { useRoom } from '../context/RoomContext';
import { Film } from 'lucide-react';

const YoutubePlayer: React.FC = () => {
  const { playbackState, playerRef, role, emitPlay, emitPause, reactions } = useRoom();

  // Refs that always hold the latest values. The player instance below is
  // created once (empty dependency array), so its event callbacks close
  // over whatever these values were at mount time. Reading through refs
  // instead of the raw variables means the callbacks always see the
  // current state, not a stale snapshot from the first render.
  const playbackStateRef = useRef(playbackState);
  const roleRef = useRef(role);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    let playerInstance: any = null;
    const playerId = 'youtube-iframe-player';

    const initializePlayer = () => {
      // Check if YouTube API script is loaded and ready
      if (!(window as any).YT || !(window as any).YT.Player) {
        setTimeout(initializePlayer, 100);
        return;
      }

      console.log('[Player] YT IFrame API is ready, constructing player...');
      playerInstance = new (window as any).YT.Player(playerId, {
        height: '100%',
        width: '100%',
        videoId: playbackStateRef.current.videoId || '',
        playerVars: {
          autoplay: playbackStateRef.current.isPlaying ? 1 : 0,
          controls: 0,       // hide native YouTube controls
          disablekb: 1,      // disable keyboard shortcuts
          fs: 0,             // disable fullscreen button
          modestbranding: 1, // hide YouTube logo watermark
          rel: 0,            // disable related videos at end
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            console.log('[Player] Player instance ready');
            playerRef.current = event.target;

            // Sync initial state on load
            const initialState = playbackStateRef.current;
            if (initialState.videoId) {
              event.target.loadVideoById({
                videoId: initialState.videoId,
                startSeconds: initialState.currentTime
              });
              if (initialState.isPlaying) {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
              }
            }
          },
          onStateChange: (event: any) => {
            // Revert state for non-hosts/mods or ignore feedback loops
            if ((window as any).isSyncing) {
              return;
            }

            const state = event.data;
            const currentPlaybackState = playbackStateRef.current;
            const isHostOrMod = roleRef.current === 'HOST' || roleRef.current === 'MODERATOR';

            if (!isHostOrMod) {
              // Block unauthorized state changes (force pause/play back to synced state)
              if (state === 1 && !currentPlaybackState.isPlaying) {
                event.target.pauseVideo();
              } else if (state === 2 && currentPlaybackState.isPlaying) {
                event.target.playVideo();
              }
              return;
            }

            // Sync host state changes
            if (state === 1 && !currentPlaybackState.isPlaying) {
              emitPlay();
            } else if (state === 2 && currentPlaybackState.isPlaying) {
              emitPause();
            }
          }
        }
      });
    };

    initializePlayer();

    return () => {
      if (playerInstance && typeof playerInstance.destroy === 'function') {
        console.log('[Player] Destroying YouTube player instance');
        playerInstance.destroy();
      }
      playerRef.current = null;
    };
  }, []);

  return (
    <div id="watch-party-player-wrapper" style={styles.playerContainer}>
      <div id="youtube-iframe-player" style={styles.iframe}></div>

      {/* Floating Reactions Overlay */}
      <div style={styles.reactionsOverlay}>
        {reactions.map((r) => (
          <span
            key={r.id}
            className="floating-reaction"
            style={{
              left: `${Math.random() * 80 + 10}%`,
              bottom: '10px'
            }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {!playbackState.videoId && (
        <div style={styles.placeholderOverlay}>
          <Film size={48} color="#8B5CF6" style={{ filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))' }} />
          <h3 style={{ marginTop: '16px', fontSize: '18px' }}>No video cued yet</h3>
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '6px', maxWidth: '300px' }}>
            Ask the Host or Moderator to paste a YouTube video ID or link in the bar below.
          </p>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  playerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: '#000000'
  },
  iframe: {
    width: '100%',
    height: '100%'
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(11, 10, 25, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    textAlign: 'center',
    padding: '20px',
    zIndex: 5
  },
  reactionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 10
  }
};

export default YoutubePlayer;