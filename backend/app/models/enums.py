from sqlalchemy import Enum

ticket_status_enum = Enum(
    "Pendente TI",
    "Em Andamento",
    "Aguardando N3",
    "Pronta p/ Fechamento",
    "Concluído",
    name="ticket_status",
    create_type=False,
)

user_role_enum = Enum(
    "admin",
    "ti",
    "rh",
    "gestor",
    "viewer",
    name="user_role",
    create_type=False,
)
