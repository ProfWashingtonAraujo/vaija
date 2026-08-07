import os
import json
import time
import redis
from printer import ThermalPrinter


REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
PRINTER_IP = os.getenv('PRINTER_IP', '192.168.1.100')
PRINTER_PORT = int(os.getenv('PRINTER_PORT', '9100'))
PRINTER_MODEL = os.getenv('PRINTER_MODEL', 'epson')
PRINT_COPIES = int(os.getenv('PRINT_COPIES', '1'))

printer = ThermalPrinter(PRINTER_IP, PRINTER_PORT, PRINTER_MODEL)


def process_print_job(job_data: dict):
    print(f"Processing print job for order #{job_data.get('orderId')}")

    receipt_data = {
        'id': job_data.get('orderId'),
        'customer': job_data.get('customer'),
        'phone': job_data.get('phone'),
        'address': job_data.get('address'),
        'items': job_data.get('items', []),
        'value': job_data.get('value', 0),
        'payment': job_data.get('payment'),
        'source': job_data.get('source'),
        'tableNumber': job_data.get('tableNumber'),
        'notes': job_data.get('notes'),
        'restaurant_name': 'Taperas Pizzaria',
        'restaurant_phone': '(11) 4002-8922',
        'date': time.strftime('%d/%m/%Y'),
        'time': time.strftime('%H:%M'),
    }

    for copy in range(PRINT_COPIES):
        try:
            if not printer.connect():
                raise ConnectionError("Cannot connect to printer")
            printer.print_receipt(receipt_data)
            print(f"Receipt printed successfully (copy {copy + 1}/{PRINT_COPIES})")
        except Exception as e:
            print(f"Print error: {e}")
            printer.disconnect()
            raise


def main():
    print(f"Print Worker starting...")
    print(f"Printer: {PRINTER_IP}:{PRINTER_PORT} ({PRINTER_MODEL})")
    print(f"Redis: {REDIS_URL}")

    try:
        r = redis.from_url(REDIS_URL)
        r.ping()
        print("Connected to Redis")
    except Exception as e:
        print(f"Cannot connect to Redis: {e}")
        print("Running in standalone mode - waiting for print jobs via HTTP")
        from flask import Flask, request, jsonify
        app = Flask(__name__)

        @app.route('/health', methods=['GET'])
        def health():
            return jsonify({'status': 'ok', 'worker': 'print'})

        @app.route('/print', methods=['POST'])
        def print_order():
            data = request.json
            try:
                process_print_job(data)
                return jsonify({'success': True})
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500

        app.run(host='0.0.0.0', port=8001)
        return

    print("Waiting for print jobs...")
    while True:
        try:
            job = r.brpop('print-jobs', timeout=5)
            if job:
                _, data = job
                job_data = json.loads(data)
                process_print_job(job_data)
        except redis.ConnectionError:
            print("Redis connection lost, reconnecting...")
            time.sleep(5)
            try:
                r = redis.from_url(REDIS_URL)
                r.ping()
                print("Reconnected to Redis")
            except Exception:
                pass
        except KeyboardInterrupt:
            print("Shutting down...")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(1)

    printer.disconnect()


if __name__ == '__main__':
    main()
