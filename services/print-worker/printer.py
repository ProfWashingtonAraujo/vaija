import socket
import time


class ThermalPrinter:
    def __init__(self, ip: str, port: int = 9100, model: str = 'epson'):
        self.ip = ip
        self.port = port
        self.model = model
        self.socket = None

    def connect(self):
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(5)
            self.socket.connect((self.ip, self.port))
            return True
        except (socket.error, socket.timeout) as e:
            print(f"Failed to connect to printer: {e}")
            return False

    def disconnect(self):
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None

    def send(self, data: bytes):
        if not self.socket:
            if not self.connect():
                raise ConnectionError("Cannot connect to printer")
        try:
            self.socket.send(data)
        except socket.error as e:
            self.disconnect()
            raise ConnectionError(f"Print error: {e}")

    def initialize(self):
        self.send(b'\x1b\x40')

    def set_bold(self, bold: bool):
        if bold:
            self.send(b'\x1b\x45\x01')
        else:
            self.send(b'\x1b\x45\x00')

    def set_double_height(self, double: bool):
        if double:
            self.send(b'\x1b\x21\x10')
        else:
            self.send(b'\x1b\x21\x00')

    def set_double_width(self, double: bool):
        if double:
            self.send(b'\x1b\x21\x20')
        else:
            self.send(b'\x1b\x21\x00')

    def set_center(self):
        self.send(b'\x1b\x61\x01')

    def set_left(self):
        self.send(b'\x1b\x61\x00')

    def set_right(self):
        self.send(b'\x1b\x61\x02')

    def feed_lines(self, lines: int = 1):
        self.send(b'\x1b\x64' + bytes([lines]))

    def cut_partial(self):
        self.send(b'\x1d\x56\x01')

    def cut_full(self):
        self.send(b'\x1d\x56\x00')

    def print_text(self, text: str, bold: bool = False, double_height: bool = False, center: bool = False):
        if center:
            self.set_center()
        if bold:
            self.set_bold(True)
        if double_height:
            self.set_double_height(True)

        self.send(text.encode('utf-8'))
        self.send(b'\n')

        if double_height:
            self.set_double_height(False)
        if bold:
            self.set_bold(False)
        if center:
            self.set_left()

    def print_line(self, char: str = '-', width: int = 32):
        self.print_text(char * width)

    def print_receipt(self, order_data: dict):
        self.initialize()

        self.print_text(order_data.get('restaurant_name', 'RESTAURANTE').upper(), bold=True, double_height=True, center=True)
        if order_data.get('restaurant_phone'):
            self.print_text(order_data['restaurant_phone'], center=True)
        self.print_line('=')
        self.print_text('CUPOM NAO FISCAL', bold=True, center=True)
        self.feed_lines()

        self.print_text(f"Pedido: #{order_data['id']}")
        self.print_text(f"Data: {order_data.get('date', time.strftime('%d/%m/%Y'))}")
        self.print_text(f"Hora: {order_data.get('time', time.strftime('%H:%M'))}")
        self.print_line('-')

        self.print_text('ITENS', bold=True)
        for i, item in enumerate(order_data.get('items', []), 1):
            self.print_text(f"  {i}. {item}")
        self.print_line('-')

        subtotal = order_data.get('subtotal', 0)
        delivery_fee = order_data.get('delivery_fee', 0)
        total = order_data.get('value', 0)

        self.print_text(f"Subtotal:           R$ {subtotal:.2f}")
        self.print_text(f"Taxa:               R$ {delivery_fee:.2f}")
        self.print_line('=')
        self.set_bold(True)
        self.print_text(f"TOTAL:              R$ {total:.2f}")
        self.set_bold(False)
        self.print_line('=')

        self.print_text(f"Pagamento: {order_data.get('payment', 'N/A')}")
        if order_data.get('customer'):
            self.print_text(f"Cliente: {order_data['customer']}")
        if order_data.get('phone'):
            self.print_text(f"Telefone: {order_data['phone']}")
        if order_data.get('address'):
            self.print_text(f"Endereco: {order_data['address']}")
        if order_data.get('tableNumber'):
            self.print_text(f"Mesa: {order_data['tableNumber']}")
        if order_data.get('notes'):
            self.print_line('-')
            self.print_text(f"OBS: {order_data['notes']}")

        self.print_line('=')
        self.print_text('Obrigado pela preferencia!', center=True)
        self.print_text(order_data.get('restaurant_name', ''), center=True)
        self.feed_lines(3)
        self.cut_partial()
