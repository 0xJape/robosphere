import { useState, useRef } from 'react';

function VoiceTestPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [testText, setTestText] = useState('Hello, this is a text to speech test.');
  const [status, setStatus] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Test TTS
  const handleTestTTS = async () => {
    try {
      setStatus('Generating speech...');
      const response = await fetch('http://localhost:20128/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-7db41d1bc1f89095-ibczt2-82dcd15f'
        },
        body: JSON.stringify({
          model: 'dg/aura-2-orion-en',
          input: testText
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setStatus('✅ Speech generated successfully!');

      // Auto-play the audio
      const audio = new Audio(url);
      audio.play();
    } catch (error) {
      console.error('TTS Error:', error);
      setStatus(`❌ TTS Error: ${error.message}`);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      setStatus('Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendToSTT(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatus('🎤 Recording...');
    } catch (error) {
      console.error('Recording Error:', error);
      setStatus(`❌ Recording Error: ${error.message}`);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('Processing audio...');
    }
  };

  // Send audio to STT
  const sendToSTT = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'dg/nova-3');

      const response = await fetch('http://localhost:20128/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sk-7db41d1bc1f89095-ibczt2-82dcd15f'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`STT API error: ${response.status}`);
      }

      const data = await response.json();
      setTranscription(data.text || 'No transcription received');
      setStatus('✅ Transcription complete!');
    } catch (error) {
      console.error('STT Error:', error);
      setStatus(`❌ STT Error: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>Voice API Test Panel</h2>

      {/* Status */}
      <div style={{
        padding: '10px',
        marginBottom: '20px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#fff'
      }}>
        Status: {status || 'Ready'}
      </div>

      {/* TTS Test Section */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '15px' }}>🔊 Text-to-Speech Test</h3>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            marginBottom: '10px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
        <button
          onClick={handleTestTTS}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          🔊 Generate Speech
        </button>
        {audioUrl && (
          <div style={{ marginTop: '15px' }}>
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          </div>
        )}
      </div>

      {/* STT Test Section */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: '20px',
        borderRadius: '12px'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '15px' }}>🎤 Speech-to-Text Test</h3>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '10px 20px',
            backgroundColor: isRecording ? '#f44336' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '15px'
          }}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
        </button>
        {transcription && (
          <div style={{
            padding: '15px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            marginTop: '10px'
          }}>
            <strong>Transcription:</strong>
            <p style={{ marginTop: '10px', lineHeight: '1.6' }}>{transcription}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceTestPanel;
