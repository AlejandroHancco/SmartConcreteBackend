-- ============================================================
--  SCHEMA: platform
-- ============================================================

CREATE SCHEMA IF NOT EXISTS platform;

-- ============================================================
--  1. ROLES
-- ============================================================

CREATE TABLE platform.roles (
                                id   SERIAL PRIMARY KEY,
                                name CHARACTER VARYING(50) NOT NULL UNIQUE
);

INSERT INTO platform.roles (name) VALUES
                                      ('admin'),
                                      ('editor'),
                                      ('viewer');

-- ============================================================
--  2. PERMISSIONS
--     formato recurso:accion  ej: 'tasks:create'
-- ============================================================

CREATE TABLE platform.permissions (
                                      id          CHARACTER VARYING(100) PRIMARY KEY,
                                      description TEXT
);

INSERT INTO platform.permissions (id, description) VALUES
                                                       ('projects:read',        'Ver proyectos'),
                                                       ('projects:update',      'Editar proyectos'),
                                                       ('projects:delete',      'Eliminar proyectos'),
                                                       ('tasks:create',         'Crear tareas'),
                                                       ('tasks:read',           'Ver tareas'),
                                                       ('tasks:update',         'Editar tareas'),
                                                       ('tasks:delete',         'Eliminar tareas'),
                                                       ('measurements:create',  'Tomar mediciones'),
                                                       ('measurements:read',    'Ver mediciones'),
                                                       ('measurements:delete',  'Eliminar mediciones'),
                                                       ('devices:create',       'Crear dispositivos'),
                                                       ('devices:read',         'Ver dispositivos'),
                                                       ('devices:update',       'Editar dispositivos'),
                                                       ('devices:delete',       'Eliminar dispositivos');

-- ============================================================
--  3. ROLE_PERMISSIONS
-- ============================================================

CREATE TABLE platform.role_permissions (
                                           role_id       INTEGER                NOT NULL REFERENCES platform.roles(id)       ON DELETE CASCADE,
                                           permission_id CHARACTER VARYING(100) NOT NULL REFERENCES platform.permissions(id) ON DELETE CASCADE,
                                           PRIMARY KEY (role_id, permission_id)
);

-- admin (id=1):
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT 1, id FROM platform.permissions;

-- editor (id=2): read + create + update, puede tomar mediciones
INSERT INTO platform.role_permissions (role_id, permission_id) VALUES
                                                                   (2, 'projects:read'),
                                                                   (2, 'tasks:create'),
                                                                   (2, 'tasks:read'),
                                                                   (2, 'tasks:update'),
                                                                   (2, 'measurements:create'),
                                                                   (2, 'measurements:read'),
                                                                   (2, 'devices:read');

-- viewer (id=3): solo lectura
INSERT INTO platform.role_permissions (role_id, permission_id) VALUES
                                                                   (3, 'projects:read'),
                                                                   (3, 'tasks:read'),
                                                                   (3, 'measurements:read'),
                                                                   (3, 'devices:read');

-- ============================================================
--  4. USERS
-- ============================================================

CREATE TABLE platform.users (
                                uuid       UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
                                name       CHARACTER VARYING(100)   NOT NULL,
                                last_name  CHARACTER VARYING(100),
                                password   CHARACTER VARYING(255)   NOT NULL,  -- siempre hasheado (bcrypt/argon2)
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
--  5. PROJECTS
-- ============================================================

CREATE TABLE platform.projects (
                                   uuid        UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
                                   name        CHARACTER VARYING(150)   NOT NULL,
                                   description CHARACTER VARYING(500),
                                   created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
--  6. USER_PROJECT_ROLES
--     un usuario tiene exactamente UN rol por proyecto
-- ============================================================

CREATE TABLE platform.user_project_roles (
                                             user_id     UUID    NOT NULL REFERENCES platform.users(uuid)    ON DELETE CASCADE,
                                             project_id  UUID    NOT NULL REFERENCES platform.projects(uuid) ON DELETE CASCADE,
                                             role_id     INTEGER NOT NULL REFERENCES platform.roles(id)      ON DELETE RESTRICT,
                                             assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                                             PRIMARY KEY (user_id, project_id)
);

-- ============================================================
--  7. DEVICES
--     analizadores de impedancia, MUX u otros equipos
-- ============================================================

CREATE TABLE platform.devices (
                                  id         UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
                                  name       CHARACTER VARYING(150) NOT NULL,
                                  type       CHARACTER VARYING(50),             -- 'analyzer', 'mux'
                                  ip         CHARACTER VARYING(45),             -- 45 soporta IPv6
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
--  8. TASKS
-- ============================================================

CREATE TABLE platform.tasks (
                                id          SERIAL                   PRIMARY KEY,
                                name        CHARACTER VARYING(150)   NOT NULL,
                                description CHARACTER VARYING(500),
                                status      CHARACTER VARYING(50)    DEFAULT 'pending',
                                points      NUMERIC,
                                start_freq  NUMERIC                  NOT NULL,
                                stop_freq   NUMERIC                  NOT NULL,
                                project_id  UUID                     NOT NULL REFERENCES platform.projects(uuid) ON DELETE CASCADE,
                                created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
--  9. TASK_PREFERENCES
--     historial de configuraciones de una tarea.
--     cada vez que cambia el equipo o las frecuencias se inserta
--     un nuevo registro, nunca se sobreescribe el anterior.
-- ============================================================

CREATE TABLE platform.task_preferences (
                                           id                 SERIAL                   PRIMARY KEY,
                                           task_id            INTEGER                  NOT NULL REFERENCES platform.tasks(id) ON DELETE CASCADE,

    -- snapshot del analizador de impedancias
                                           analyzer_name      CHARACTER VARYING(150)   NOT NULL,
                                           analyzer_ip        CHARACTER VARYING(45)    NOT NULL,
                                           analyzer_device_id UUID                     REFERENCES platform.devices(id) ON DELETE SET NULL,

    -- snapshot del MUX 16 a 1
                                           mux_name           CHARACTER VARYING(150)   NOT NULL,
                                           mux_ip             CHARACTER VARYING(45)    NOT NULL,
                                           mux_device_id      UUID                     REFERENCES platform.devices(id) ON DELETE SET NULL,

    -- frecuencias vigentes en esta configuración
                                           start_freq         NUMERIC                  NOT NULL,
                                           stop_freq          NUMERIC                  NOT NULL,

                                           created_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
                                           created_by         UUID                     REFERENCES platform.users(uuid) ON DELETE SET NULL
);

-- config más reciente de una task
CREATE INDEX idx_task_preferences_task_created
    ON platform.task_preferences(task_id, created_at DESC);

-- ============================================================
--  10. MEASUREMENTS
--      snapshot completo por cada medición tomada.
--
--      estructura del JSONB en 'data':
--      [
--        { "frequency": 280000, "g": [g1..g16], "b": [b1..b16] },
--        { "frequency": 284030, "g": [g1..g16], "b": [b1..b16] },
--        ...  (801 filas)
--      ]
-- ============================================================

CREATE TABLE platform.measurements (
                                       id                 SERIAL                   PRIMARY KEY,
                                       task_id            INTEGER                  NOT NULL REFERENCES platform.tasks(id)  ON DELETE CASCADE,

    -- quién y cuándo
                                       taken_by           UUID                     NOT NULL REFERENCES platform.users(uuid) ON DELETE RESTRICT,
                                       taken_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- snapshot de frecuencias al momento de medir
                                       start_freq         NUMERIC                  NOT NULL,
                                       stop_freq          NUMERIC                  NOT NULL,

    -- snapshot del equipo al momento de medir
                                       analyzer_name      CHARACTER VARYING(150)   NOT NULL,
                                       analyzer_ip        CHARACTER VARYING(45)    NOT NULL,
                                       mux_name           CHARACTER VARYING(150)   NOT NULL,
                                       mux_ip             CHARACTER VARYING(45)    NOT NULL,

    -- referencia a la config activa cuando se tomó la medición
                                       task_preference_id INTEGER                  REFERENCES platform.task_preferences(id) ON DELETE SET NULL,

    -- datos crudos del CSV: 801 filas con frequency, g[1..16], b[1..16]
                                       data               JSONB                    NOT NULL
);

CREATE INDEX idx_measurements_task_taken
    ON platform.measurements(task_id, taken_at DESC);

CREATE INDEX idx_measurements_data_gin
    ON platform.measurements USING GIN(data);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  El backend debe ejecutar antes de cada query:
--  SET app.current_user_id = 'uuid-del-usuario';
-- ============================================================

ALTER TABLE platform.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.task_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.measurements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.devices          ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_isolation ON platform.tasks
    USING (
        project_id IN (
            SELECT project_id
            FROM platform.user_project_roles
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

CREATE POLICY task_preferences_isolation ON platform.task_preferences
    USING (
        task_id IN (
            SELECT t.id
            FROM platform.tasks t
            JOIN platform.user_project_roles upr ON upr.project_id = t.project_id
            WHERE upr.user_id = current_setting('app.current_user_id')::UUID
        )
    );

CREATE POLICY measurements_isolation ON platform.measurements
    USING (
        task_id IN (
            SELECT t.id
            FROM platform.tasks t
            JOIN platform.user_project_roles upr ON upr.project_id = t.project_id
            WHERE upr.user_id = current_setting('app.current_user_id')::UUID
        )
    );

CREATE POLICY devices_isolation ON platform.devices
    USING (
        EXISTS (
            SELECT 1
            FROM platform.user_project_roles
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- ============================================================
--  FUNCIÓN: has_permission
--  SELECT platform.has_permission('uuid-user','uuid-project','tasks:create');
-- ============================================================

CREATE OR REPLACE FUNCTION platform.has_permission(
    p_user_id    UUID,
    p_project_id UUID,
    p_permission CHARACTER VARYING
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
SELECT EXISTS (
    SELECT 1
    FROM platform.user_project_roles upr
             JOIN platform.role_permissions rp ON rp.role_id = upr.role_id
    WHERE upr.user_id     = p_user_id
      AND upr.project_id  = p_project_id
      AND rp.permission_id = p_permission
);
$$;

-- ============================================================
--  FUNCIÓN: get_active_preference
--  Retorna la configuración activa más reciente de una tarea.
--  SELECT * FROM platform.get_active_preference(1);
-- ============================================================

CREATE OR REPLACE FUNCTION platform.get_active_preference(p_task_id INTEGER)
RETURNS SETOF platform.task_preferences
LANGUAGE sql
STABLE
AS $$
SELECT *
FROM platform.task_preferences
WHERE task_id = p_task_id
ORDER BY created_at DESC
    LIMIT 1;
$$;