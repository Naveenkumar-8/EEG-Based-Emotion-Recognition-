from flask import Flask, render_template, request, jsonify, send_from_directory, url_for
import os, numpy as np, json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path

BASE_DIR = Path(__file__).parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"
PLOT_PATH = STATIC_DIR / "plot.png"
LAST_JSON = BASE_DIR / "static" / "last_result.json"
UPLOAD_FOLDER.mkdir(exist_ok=True)

app = Flask(__name__)

LABELS = ["Happy","Sad","Neutral"]

def dummy_predict_frame(frame):
    m = float(np.mean(frame))
    if m > 0.3:
        return "Happy", min(0.99, abs(m))
    elif m < -0.3:
        return "Sad", min(0.99, abs(m))
    else:
        return "Neutral", min(0.99, 0.5 + abs(m))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/static/<path:p>')
def static_file(p):
    return send_from_directory(BASE_DIR / 'static', p)

@app.route('/analyze', methods=['POST'])
def analyze():
    f = request.files.get('file')
    if not f:
        return jsonify({"error":"no file uploaded"}), 400
    filename = f.filename
    save_path = UPLOAD_FOLDER / filename
    f.save(str(save_path))
    # load data
    data = None
    try:
        if filename.lower().endswith('.npy'):
            data = np.load(str(save_path))
        else:
            data = np.loadtxt(str(save_path), delimiter=',')
    except Exception:
        try:
            data = np.loadtxt(str(save_path))
        except Exception:
            data = np.random.randn(2048)
    data = np.asarray(data).flatten()
    # normalize
    if np.std(data) > 0:
        data = (data - np.mean(data)) / (np.std(data) + 1e-8)
    # prepare frames for realistic streaming (12 seconds, 60 frames)
    duration_sec = 12.0
    frames = 60
    frame_len = max(1, int(len(data) / frames))
    labels = []
    confidences = []
    for i in range(frames):
        start = i*frame_len
        end = min(len(data), start+frame_len)
        frame = data[start:end]
        if len(frame) < 4:
            frame = np.pad(frame, (0, max(0,4-len(frame))), 'constant')
        label, conf = dummy_predict_frame(frame)
        labels.append(label)
        confidences.append(round(float(conf),3))
    # Save full-plot for dashboard (entire waveform)
    try:
        plt.figure(figsize=(10,3))
        plt.plot(data, linewidth=1)
        plt.title('EEG Signal (full)')
        plt.xlabel('Sample')
        plt.ylabel('Amplitude (normalized)')
        plt.tight_layout()
        plt.savefig(str(PLOT_PATH))
        plt.close()
    except Exception as e:
        print("Plot save failed:", e)
    # write last result json
    last = {
        "label": labels[-1] if labels else "Neutral",
        "confidence": confidences[-1] if confidences else 0.0,
        "plot": url_for('static_file', p='plot.png'),
        "labels": labels,
        "confidences": confidences
    }
    try:
        with open(LAST_JSON, 'w') as jf:
            json.dump(last, jf)
    except Exception as e:
        print("Failed to write last_result.json", e)
    return jsonify({
        "data": data.tolist(),
        "frames": frames,
        "frame_len": frame_len,
        "labels": labels,
        "confidences": confidences,
        "duration_sec": duration_sec
    })

@app.route('/latest')
def latest():
    if LAST_JSON.exists():
        try:
            with open(LAST_JSON,'r') as f:
                return jsonify(json.load(f))
        except Exception as e:
            return jsonify({"error":"failed to read"}),500
    return jsonify({"label":"-","confidence":0,"plot":url_for('static_file', p='plot.png')})

@app.route('/health')
def health():
    return jsonify({"status":"ok"})

if __name__ == '__main__':
    app.run(debug=True)
