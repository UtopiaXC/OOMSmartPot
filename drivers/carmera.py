import cv2
from flask import Flask, Response

app = Flask(__name__)
cap = cv2.VideoCapture(0)

def generate_frames():
    
    while True:
        success, frame = cap.read()
        if not success:
            break

        # 转成 JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        # MJPEG 流格式
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video')
def video():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/')
def index():
    return '<img src="/video" width="640">'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
