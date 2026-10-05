"""Gera o SQL para redefinir a senha do admin da plataforma (tenant 'admin').

A senha é digitada no terminal (sem eco) e nunca é impressa; só o hash bcrypt vai no SQL.
Rode dentro da imagem da API (já tem passlib/bcrypt):

  docker build -q -t vaija-api-tools services/api
  docker run --rm -it -v "${PWD}/scripts:/s" vaija-api-tools python /s/gen_admin_reset_sql.py
"""
import sys
from getpass import getpass

from passlib.context import CryptContext

MIN_LEN = 12

password = getpass("Nova senha do admin (min. 12 caracteres): ")
if len(password) < MIN_LEN:
    sys.exit(f"Senha curta demais: use pelo menos {MIN_LEN} caracteres.")
if getpass("Repita a senha: ") != password:
    sys.exit("As senhas não conferem.")

hashed = CryptContext(schemes=["bcrypt"]).hash(password)

print("\n-- Cole no SQL Editor do Supabase e execute (Run):\n")
print(f"""update users
   set password_hash = '{hashed}', updated_at = now()
 where tenant_id = 'admin' and role_key = 'admin';

-- encerra sessões antigas do admin
delete from auth_sessions
 where user_id in (select id from users where tenant_id = 'admin');
""")
