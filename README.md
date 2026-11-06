# MES Práctica – Panel de órdenes de producción

Proyecto para practicar el stack de la empresa:

- **Backend:** Node + Fastify + Prisma + Zod (Prisma registrado como `app.db`)
- **Frontend:** React + Vite + TypeScript + Mantine + TanStack Query + Redux Toolkit
- **Base de datos:** PostgreSQL en Docker

## Estructura

```
mes-practica/
├── docker-compose.yml          # PostgreSQL + backend (3001) + frontend (8082)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos Machine, ProductionOrder, User, Employee y WorkLog
│   │   └── seed.ts             # Datos de ejemplo (empleados con PIN y WorkLog) + usuario admin
│   └── src/
│       ├── server.ts           # Arranque
│       ├── app.ts              # Crea Fastify, registra plugins y rutas (públicas, ADMIN y EMPLOYEE)
│       ├── plugins/
│       │   ├── prisma.ts       # app.db (oculta pinHash con omit global)
│       │   └── auth.ts         # JWT + bcrypt, decorador app.requireRole
│       └── modules/
│           ├── auth/           # login (admin), employee-login (código + PIN) y /me
│           ├── machines/       # schema (Zod) + routes
│           ├── employees/      # schema (Zod) + routes (CRUD + stats)
│           ├── orders/         # schema (Zod) + routes + worklogs.ts (helpers de WorkLog en transacción)
│           │                   #   + orders.import.ts (leer y validar el Excel de importación)
│           ├── shopfloor/      # planta (solo EMPLOYEE): sus órdenes, iniciar y finalizar
│           └── dashboard/      # planta en vivo, incidencias y estadísticas por rango (ADMIN)
└── frontend/
    └── src/
        ├── main.tsx            # MantineProvider + DatesProvider (es) + QueryClientProvider + Redux Provider
        ├── App.tsx             # Rutas: /login pública, panel (ADMIN) y /planta (EMPLOYEE)
        ├── api/
        │   ├── client.ts       # fetch base a http://localhost:3001/api, añade el token y gestiona el 401
        │   ├── auth.ts         # login y employeeLogin
        │   ├── machines.ts     # funciones getMachines, createMachine...
        │   ├── orders.ts       # incluye assignEmployee, changeOrderStatus e importación desde Excel
        │   ├── employees.ts
        │   ├── shopfloor.ts    # órdenes del empleado, startWork, stopWork
        │   └── dashboard.ts    # getLiveWork, getIncidents, getDashboardStats
        ├── hooks/              # useMachines, useOrders, useEmployees, useLogin... (TanStack Query)
        │   └── queryKeys.ts    # claves de caché compartidas
        ├── store/
        │   ├── index.ts        # configureStore
        │   ├── authSlice.ts    # token y usuario (persistidos en localStorage)
        │   └── uiSlice.ts      # filtro de órdenes, empleado seleccionado, rango de Informes, modo oscuro
        ├── pages/
        │   ├── LoginPage.tsx       # pestañas Administrador / Empleado
        │   ├── DashboardPage.tsx
        │   ├── MachinesPage.tsx
        │   ├── OrdersPage.tsx
        │   ├── EmployeesPage.tsx
        │   ├── ReportsPage.tsx     # rango de fechas, gráficos y exportar CSV
        │   └── ShopfloorPage.tsx   # /planta, pantalla táctil del empleado
        ├── components/
        │   ├── dashboard/      # StatCard, gráfico por estado, máquinas, Trabajando ahora, Incidencias
        │   ├── reports/        # gráficos de Informes y statsCsv (CSV generado en el navegador)
        │   ├── auth/           # ProtectedRoute (por rol), AdminLoginForm, EmployeeLoginForm, homePath
        │   ├── layout/         # AppLayout (AppShell + usuario + cerrar sesión), Navbar
        │   ├── machines/       # MachineTable, MachineForm
        │   ├── orders/         # OrderTable, OrderForm, StatusBadge, AssignEmployeeModal, ImportOrdersModal
        │   ├── employees/      # EmployeeTable, EmployeeForm, EmployeeDetailDrawer
        │   ├── shopfloor/      # ActiveWorkCard, ElapsedTimer, ShopfloorOrderCard, StopWorkModal
        │   └── worklogs/       # etiquetas y colores de los motivos de parada
        └── types/              # Machine, ProductionOrder, Employee...
```

## Arrancar el backend

```bash
# 1. Base de datos
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env                  # rellenar JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD
npm install
npx prisma migrate dev                # crea las tablas
npm run db:seed                       # datos de ejemplo + usuario admin
npm run dev                           # http://localhost:3001
```

Para ver la base de datos: `npm run db:studio`.

## Tests

```bash
# Backend: usa una BD aparte (db-test, puerto 5433, en memoria) que se vacía antes de cada test
docker compose up -d db-test
cd backend && npm test

# Frontend: componentes con Testing Library, la API mockeada (no necesita backend)
cd frontend && npm test
```

`npm run test:watch` los relanza al guardar. Qué cubren:

- **Backend** (`backend/test/`): auth (login, 401, 403), órdenes (transiciones, máquina en mantenimiento, reasignar con trabajo abierto), importación desde Excel (archivo válido, errores por fila, códigos repetidos, archivo que no es .xlsx, plantilla) y planta (iniciar, finalizar, DONE al completar, incidencia → `MAINTENANCE`).
- **Frontend** (`*.test.tsx`): `StatusBadge`, estados de `OrdersPage` (carga, error, vacío, tabla) y la nota obligatoria del modal de finalizar.

## Autenticación

Hay dos roles: `ADMIN` (panel de gestión, entra con email y contraseña) y `EMPLOYEE` (pantalla de planta, entra con código y PIN). El admin se crea con el seed a partir de `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env` (volver a lanzar el seed actualiza su contraseña).

| Variable         | Para qué                                       |
|------------------|------------------------------------------------|
| `JWT_SECRET`     | Firma de los tokens (cadena larga y aleatoria) |
| `ADMIN_EMAIL`    | Email del admin que crea el seed               |
| `ADMIN_PASSWORD` | Contraseña del admin que crea el seed          |

Empleados de prueba del seed (acceso a planta con código + PIN):

| Código | Nombre     | PIN  |
|--------|------------|------|
| EMP-01 | Ana López  | 1111 |
| EMP-02 | Luis Pérez | 2222 |
| EMP-03 | Marta Ruiz | 3333 |
| EMP-04 | Jorge Sanz | 4444 (inactivo: no puede entrar) |

- Los dos logins devuelven `{ token, user }` con un JWT válido 8 h, que lleva el rol (y `employeeId` en el de empleado). Las rutas protegidas lo esperan en `Authorization: Bearer <token>`.
- Sin token o con token inválido: `401`. Con token válido pero de otro rol: `403`.
- `POST /api/auth/employee-login` admite 5 intentos por minuto y por IP (`429` después): un PIN de 4 dígitos se adivinaría probando.
- Un empleado desactivado deja de poder usar `/api/shopfloor` aunque su token siga vigente (`401`).
- En Docker, `JWT_SECRET` se toma del entorno o de un `.env` en la raíz; si no existe se usa un valor solo para desarrollo.

Prueba con curl:

```bash
curl http://localhost:3001/api/machines     # 401

TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mes.local","password":"<ADMIN_PASSWORD>"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/machines   # 200
```

En el frontend, sin sesión cualquier ruta redirige a `/login`. Cada rol tiene su zona: el admin el panel y el empleado solo `/planta`; si abre una ruta de la otra zona, se le lleva a la suya. Un `401` de la API cierra la sesión y vuelve al login.

## Endpoints

Todos exigen token de admin salvo los marcados como públicos o de empleado.

| Método | Ruta                       | Qué hace                         |
|--------|----------------------------|----------------------------------|
| GET    | /api/health                | Estado del servidor (pública)    |
| POST   | /api/auth/login            | Login de admin: `{ token, user }` (pública) |
| POST   | /api/auth/employee-login   | Login de empleado `{ code, pin }`: `{ token, user }` (pública, 5/min) |
| GET    | /api/auth/me               | Usuario de la sesión actual (admin o empleado) |
| GET    | /api/machines              | Lista máquinas                   |
| GET    | /api/machines/:id          | Detalle con sus órdenes          |
| POST   | /api/machines              | Crea máquina                     |
| PATCH  | /api/machines/:id          | Edita máquina                    |
| DELETE | /api/machines/:id          | Borra máquina                    |
| GET    | /api/orders?status=&machineId= | Lista órdenes (con filtros)  |
| GET    | /api/orders/summary        | Nº de órdenes por estado         |
| GET    | /api/orders/import/template | Descarga la plantilla .xlsx     |
| POST   | /api/orders/import/preview | Valida un .xlsx (multipart, campo `file`) sin guardar: `{ valid, errors }` |
| POST   | /api/orders/import         | Importa un .xlsx: todo o nada. 201 `{ created }`; con errores 400 `{ message, errors }` |
| GET    | /api/orders/:id            | Detalle                          |
| POST   | /api/orders                | Crea orden                       |
| PATCH  | /api/orders/:id            | Edita orden (no `producedQty`)   |
| PATCH  | /api/orders/:id/status     | Cambia estado y guarda fechas. Body: `{ status }`. 400 al terminar/cancelar con alguien trabajando |
| PATCH  | /api/orders/:id/assign     | Asigna, cambia o quita el empleado. Body: `{ employeeId \| null }`. 400 con alguien trabajando |
| DELETE | /api/orders/:id            | Borra orden (y sus WorkLog)      |
| GET    | /api/employees             | Lista empleados con `totalHours` y `totalUnits` |
| GET    | /api/employees/:id         | Detalle                          |
| GET    | /api/employees/:id/stats   | Totales, desglose por orden y registros de trabajo (con motivo y nota) |
| POST   | /api/employees             | Crea empleado (409 si el código existe) |
| PATCH  | /api/employees/:id         | Edita empleado                   |
| DELETE | /api/employees/:id         | Borra empleado (409 si tiene WorkLog: desactivarlo) |
| GET    | /api/shopfloor/orders      | Empleado: sus órdenes pendientes o en curso, con su `openWorkLog` |
| POST   | /api/shopfloor/orders/:id/start | Empleado: abre un WorkLog (PENDING → IN_PROGRESS) |
| POST   | /api/shopfloor/worklogs/:id/stop | Empleado: cierra su WorkLog. Body: `{ producedQty, stopReason, note? }`. Con `MACHINE_ISSUE`, la máquina pasa a `MAINTENANCE` |
| GET    | /api/dashboard/live        | WorkLog abiertos: empleado, orden, máquina y `startedAt` |
| GET    | /api/dashboard/incidents?limit= | Últimas incidencias (`MACHINE_ISSUE`) con empleado, máquina y su estado, nota y fecha (10 por defecto, máx. 50) |
| GET    | /api/dashboard/stats?from=&to= | Horas y unidades por empleado y por máquina en `[from, to)`, y minutos parados por motivo |

## Empleados y registro de tiempo

Cada orden puede tener un empleado asignado. El tiempo y las unidades se registran en tramos (`WorkLog`) que controla el propio empleado desde la pantalla de planta (`/planta`); el admin no los abre ni los cierra.

1. **Iniciar:** abre un WorkLog (`startedAt`). Si la orden estaba `PENDING`, pasa a `IN_PROGRESS`.
2. **Finalizar:** cierra el WorkLog con `endedAt`, `producedQty` (obligatorio, >= 0) y un motivo (`stopReason`):

   | Motivo | Significado |
   |--------|-------------|
   | `END_OF_SHIFT` | Fin de jornada |
   | `BREAK` | Descanso |
   | `MACHINE_ISSUE` | Incidencia en la máquina (`note` obligatoria) |
   | `LINE_CHANGE` | Cambio a otra línea |

3. `producedQty` de la orden es siempre la suma de sus WorkLog. Si llega a `quantity`, la orden pasa a `DONE`.
4. Si el motivo es `MACHINE_ISSUE`, la máquina de la orden pasa a `MAINTENANCE` en la misma transacción.

Reglas:

- Un empleado solo ve e inicia las órdenes que tiene asignadas, y solo puede tener un trabajo abierto a la vez.
- Con alguien trabajando en una orden, el admin no puede reasignarla, terminarla ni cancelarla (`400`): primero tiene que finalizar el empleado.

Garantías:

- Iniciar y finalizar van en una transacción de Prisma que bloquea la fila de la orden (y la del empleado al iniciar) con `SELECT … FOR UPDATE`: o se aplica todo o nada, y dos peticiones simultáneas no se pisan.
- Índices únicos parciales en PostgreSQL: como máximo un WorkLog abierto por orden y uno por empleado.
- Un `CHECK` en la BD impide guardar una incidencia de máquina sin nota.

Flujo con curl (Luis, EMP-02, sobre una orden suya; ids de ejemplo):

```bash
J='Content-Type: application/json'; API=http://localhost:3001/api
EMP=$(curl -s -X POST $API/auth/employee-login -H "$J" -d '{"code":"EMP-02","pin":"2222"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
H="Authorization: Bearer $EMP"

curl -H "$H" $API/shopfloor/orders                       # sus órdenes
curl -X POST -H "$H" $API/shopfloor/orders/2/start       # iniciar: 201, devuelve el WorkLog
curl -X POST -H "$H" $API/shopfloor/orders/2/start       # repetido: 400
curl -X POST -H "$H" -H "$J" $API/shopfloor/worklogs/7/stop \
  -d '{"producedQty":15,"stopReason":"MACHINE_ISSUE","note":"Atasco en la matriz"}'
```

En el panel de admin, el detalle de cada empleado muestra sus registros de trabajo con motivo y nota, y en Órdenes se marca quién está trabajando.

## Planta en vivo, incidencias e informes

- **Dashboard → Trabajando ahora:** cada empleado con un trabajo abierto, su orden y un temporizador desde `startedAt`. Se refresca cada 15 s.
- **Dashboard → Incidencias recientes:** máquina, orden, nota, empleado y fecha. Si la máquina sigue en mantenimiento, el botón **Reactivar máquina** la pone en `ACTIVE`. También cada 15 s.
- **Informes (`/reports`):** rango de fechas (ambos días incluidos; por defecto los últimos 7), unidades por empleado, horas por máquina y reparto del tiempo parado por motivo. **Exportar CSV** descarga los datos del rango (`;` como separador y coma decimal, para Excel en español).

Cómo se calcula `/stats`:

- **Horas:** solo la parte de cada WorkLog dentro del rango; uno abierto cuenta hasta ahora.
- **Unidades:** las de los WorkLog cerrados dentro del rango (se declaran al cerrar).
- **Minutos parados:** desde cada cierre dentro del rango hasta el siguiente inicio en la misma máquina (o en la misma orden, si no tiene máquina), con el motivo de ese cierre. Un `END_OF_SHIFT` incluye la noche.
- La máquina de un WorkLog es la que tiene **ahora** su orden: el WorkLog no la guarda.

## Importar órdenes desde Excel

En **Órdenes → Importar Excel**: se descarga la plantilla, se suelta el archivo y se ve una vista previa con los errores antes de guardar nada.

Formato (primera hoja, cabeceras en la fila 1):

| Columna | Obligatoria | Contenido |
|---------|-------------|-----------|
| `codigo` | Sí | Código único de la orden (máx. 30) |
| `producto` | Sí | Texto (máx. 100) |
| `cantidad` | Sí | Entero mayor que 0 |
| `maquina` | No | Código de una máquina `ACTIVE` |
| `empleado` | No | Código de un empleado activo |
| `inicio_previsto` | No | Fecha de Excel o texto `dd/mm/aaaa` |

- Solo `.xlsx`, máximo 5 MB y 1000 filas. Las filas vacías se ignoran.
- Cada error indica su fila de Excel, la columna y el motivo: campos obligatorios, cantidad no válida, código repetido en el archivo o ya existente, máquina inexistente o no activa, empleado inexistente o inactivo.
- **Todo o nada:** con un solo error no se importa ninguna fila. Al importar se vuelve a validar y las órdenes se crean en una transacción.

```bash
curl -H "Authorization: Bearer $TOKEN" -o plantilla.xlsx $API/orders/import/template
curl -H "Authorization: Bearer $TOKEN" -F file=@plantilla.xlsx $API/orders/import/preview
curl -H "Authorization: Bearer $TOKEN" -F file=@plantilla.xlsx $API/orders/import
```

## Arrancar el frontend

Con el backend en marcha:

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:3001/api
npm install
npm run dev             # http://localhost:5173 → redirige a /login (pestañas Administrador / Empleado)
```

## Todo con Docker

```bash
docker compose up -d --build    # BD (5432) + backend (3001) + frontend (http://localhost:8082)
```

El contenedor del backend aplica las migraciones al arrancar, pero no ejecuta el seed. Para crear el admin, desde el host (la BD es la misma):

```bash
cd backend && npm run db:seed
```

Tras cambiar código hay que volver a lanzar `docker compose up -d --build`; si no, los contenedores siguen con la versión anterior.

## Hoja de ruta

- [x] **Fase 1 – Backend:** arrancarlo, probar todos los endpoints, añadir uno nuevo (resumen por estado).
- [x] **Fase 2 – Frontend base:** AppShell, tabla de órdenes, formulario de crear orden, TanStack Query.
- [x] **Fase 3 – Redux y dashboard:** filtros en Redux, tarjetas por estado, gráfico.
- [ ] **Fase 4 – Extra:**
  - [x] Dockerizar backend y frontend.
  - [ ] Repo con commits limpios.
- [x] **Fase 5 – Login:** usuarios con rol `ADMIN`, JWT, rutas protegidas en backend y frontend.
- [x] **Fase 6 – Empleados:** CRUD, asignación a órdenes, registro de tiempo (WorkLog) en transacciones, estadísticas por empleado.
- [x] **Fase 7 – Planta:** login de empleado con PIN, roles en rutas, pantalla táctil con temporizador, motivos de parada.
- [x] **Fase 8 – Planta en vivo e incidencias:** máquina a mantenimiento con `MACHINE_ISSUE`, quién trabaja ahora, incidencias con reactivar máquina, Informes con gráficos y exportación CSV.

## Retos

- [x] Que no se pueda pasar una orden de `DONE` a `PENDING` (transiciones válidas en `ORDER_TRANSITIONS`).
- [x] Que al asignar una orden a una máquina en `MAINTENANCE` devuelva un error 400.
- [x] Barra de progreso en la tabla (`producedQty / quantity`) con el componente `Progress` de Mantine.
