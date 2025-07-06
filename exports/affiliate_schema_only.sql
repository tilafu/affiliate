--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_drive_configuration_tasks_required(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_drive_configuration_tasks_required() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update the tasks_required count in the drive_configurations table
    UPDATE drive_configurations
    SET tasks_required = (
        SELECT COUNT(*) 
        FROM drive_configuration_items 
        WHERE drive_configuration_id = 
            CASE
                WHEN TG_OP = 'DELETE' THEN OLD.drive_configuration_id
                ELSE NEW.drive_configuration_id
            END
    ),
    updated_at = NOW()
    WHERE id = 
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.drive_configuration_id
            ELSE NEW.drive_configuration_id
        END;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_drive_configuration_tasks_required() OWNER TO postgres;

--
-- Name: update_onboarding_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_onboarding_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_onboarding_updated_at() OWNER TO postgres;

--
-- Name: update_tier_quantity_configs_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_tier_quantity_configs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_tier_quantity_configs_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(10),
    balance numeric(12,2) DEFAULT 0,
    frozen numeric(12,2) DEFAULT 0,
    cap numeric(12,2),
    is_active boolean DEFAULT true,
    deposit numeric(10,2) DEFAULT 0,
    withdrawal numeric(10,2) DEFAULT 0,
    CONSTRAINT accounts_type_check CHECK (((type)::text = ANY ((ARRAY['main'::character varying, 'training'::character varying])::text[])))
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_id_seq OWNER TO postgres;

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_notifications (
    id integer NOT NULL,
    user_id integer,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_notifications OWNER TO postgres;

--
-- Name: admin_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_notifications_id_seq OWNER TO postgres;

--
-- Name: admin_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_notifications_id_seq OWNED BY public.admin_notifications.id;


--
-- Name: chat_admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_admin_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_admin_logs_id_seq OWNER TO postgres;

--
-- Name: chat_admin_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_admin_logs (
    id integer DEFAULT nextval('public.chat_admin_logs_id_seq'::regclass) NOT NULL,
    admin_id integer NOT NULL,
    action_type character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_admin_logs OWNER TO postgres;

--
-- Name: chat_fake_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_fake_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_fake_users_id_seq OWNER TO postgres;

--
-- Name: chat_fake_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_fake_users (
    id integer DEFAULT nextval('public.chat_fake_users_id_seq'::regclass) NOT NULL,
    username character varying(50) NOT NULL,
    display_name character varying(100),
    avatar_url character varying(255),
    bio text,
    is_active boolean DEFAULT true,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_fake_users OWNER TO postgres;

--
-- Name: chat_group_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_group_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_group_members_id_seq OWNER TO postgres;

--
-- Name: chat_group_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_group_members (
    id integer DEFAULT nextval('public.chat_group_members_id_seq'::regclass) NOT NULL,
    group_id integer NOT NULL,
    user_id integer,
    fake_user_id integer,
    join_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    last_read_message_id integer,
    last_read_at timestamp without time zone,
    CONSTRAINT user_or_fake_user CHECK ((((user_id IS NOT NULL) AND (fake_user_id IS NULL)) OR ((user_id IS NULL) AND (fake_user_id IS NOT NULL))))
);


ALTER TABLE public.chat_group_members OWNER TO postgres;

--
-- Name: chat_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_groups_id_seq OWNER TO postgres;

--
-- Name: chat_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_groups (
    id integer DEFAULT nextval('public.chat_groups_id_seq'::regclass) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    group_type character varying(20) DEFAULT 'standard'::character varying,
    max_members integer DEFAULT 150,
    is_active boolean DEFAULT true,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_groups OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO postgres;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id integer DEFAULT nextval('public.chat_messages_id_seq'::regclass) NOT NULL,
    group_id integer NOT NULL,
    user_id integer,
    fake_user_id integer,
    content text NOT NULL,
    media_url character varying(255),
    media_type character varying(50),
    is_pinned boolean DEFAULT false,
    is_automated boolean DEFAULT false,
    sent_by_admin boolean DEFAULT false,
    admin_id integer,
    parent_message_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_or_fake_user_message CHECK ((((user_id IS NOT NULL) AND (fake_user_id IS NULL)) OR ((user_id IS NULL) AND (fake_user_id IS NOT NULL))))
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: chat_scheduled_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_scheduled_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_scheduled_messages_id_seq OWNER TO postgres;

--
-- Name: chat_scheduled_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_scheduled_messages (
    id integer DEFAULT nextval('public.chat_scheduled_messages_id_seq'::regclass) NOT NULL,
    group_id integer NOT NULL,
    fake_user_id integer NOT NULL,
    content text NOT NULL,
    media_url character varying(255),
    media_type character varying(50),
    scheduled_time timestamp without time zone NOT NULL,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(50),
    scheduled_by integer NOT NULL,
    is_sent boolean DEFAULT false,
    sent_message_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_scheduled_messages OWNER TO postgres;

--
-- Name: commission_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commission_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    source_user_id integer,
    source_action_id integer,
    account_type character varying(10),
    commission_amount numeric(12,2) NOT NULL,
    commission_type character varying(500) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    reference_id character varying(255),
    drive_session_id integer,
    CONSTRAINT commission_logs_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['main'::character varying, 'training'::character varying])::text[])))
);


ALTER TABLE public.commission_logs OWNER TO postgres;

--
-- Name: commission_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.commission_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.commission_logs_id_seq OWNER TO postgres;

--
-- Name: commission_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.commission_logs_id_seq OWNED BY public.commission_logs.id;


--
-- Name: deposit_qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deposit_qr_codes (
    id integer NOT NULL,
    qr_code_url character varying(500) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    uploaded_by_admin_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    wallet_address character varying(255)
);


ALTER TABLE public.deposit_qr_codes OWNER TO postgres;

--
-- Name: COLUMN deposit_qr_codes.wallet_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deposit_qr_codes.wallet_address IS 'Wallet address associated with the QR code for deposit payments';


--
-- Name: deposit_qr_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deposit_qr_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deposit_qr_codes_id_seq OWNER TO postgres;

--
-- Name: deposit_qr_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deposit_qr_codes_id_seq OWNED BY public.deposit_qr_codes.id;


--
-- Name: deposits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deposits (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    txn_hash character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    client_image_url character varying(500),
    client_image_filename character varying(255),
    CONSTRAINT deposits_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.deposits OWNER TO postgres;

--
-- Name: deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deposits_id_seq OWNER TO postgres;

--
-- Name: deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deposits_id_seq OWNED BY public.deposits.id;


--
-- Name: old_drive_configuration_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.old_drive_configuration_items (
    id integer NOT NULL,
    drive_configuration_id integer NOT NULL,
    product_id integer NOT NULL,
    order_in_drive integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.old_drive_configuration_items OWNER TO postgres;

--
-- Name: drive_configuration_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_configuration_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_configuration_items_id_seq OWNER TO postgres;

--
-- Name: drive_configuration_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_configuration_items_id_seq OWNED BY public.old_drive_configuration_items.id;


--
-- Name: drive_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_configurations (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_by_admin_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tasks_required integer NOT NULL,
    balance_filter_enabled boolean DEFAULT true,
    tier_quantity_enabled boolean DEFAULT true,
    min_balance_percentage numeric(5,2) DEFAULT 75.00,
    max_balance_percentage numeric(5,2) DEFAULT 99.00,
    is_auto_generated boolean DEFAULT false,
    associated_user_id integer,
    is_tier_based boolean DEFAULT false,
    CONSTRAINT tasks_required_positive CHECK ((tasks_required > 0))
);


ALTER TABLE public.drive_configurations OWNER TO postgres;

--
-- Name: COLUMN drive_configurations.balance_filter_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_configurations.balance_filter_enabled IS 'Enable/disable balance-based product filtering (75%-99% range)';


--
-- Name: COLUMN drive_configurations.tier_quantity_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_configurations.tier_quantity_enabled IS 'Enable/disable tier-based quantity limits';


--
-- Name: COLUMN drive_configurations.min_balance_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_configurations.min_balance_percentage IS 'Minimum balance percentage for product filtering';


--
-- Name: COLUMN drive_configurations.max_balance_percentage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_configurations.max_balance_percentage IS 'Maximum balance percentage for product filtering';


--
-- Name: COLUMN drive_configurations.is_auto_generated; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_configurations.is_auto_generated IS 'Indicates if this configuration was auto-generated by the system';


--
-- Name: COLUMN drive_configurations.associated_user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_configurations.associated_user_id IS 'User ID for whom this configuration was specifically created (for auto-generated configs)';


--
-- Name: drive_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_configurations_id_seq OWNER TO postgres;

--
-- Name: drive_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_configurations_id_seq OWNED BY public.drive_configurations.id;


--
-- Name: drive_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_orders (
    id integer NOT NULL,
    session_id integer NOT NULL,
    task_set_product_id integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


ALTER TABLE public.drive_orders OWNER TO postgres;

--
-- Name: TABLE drive_orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.drive_orders IS 'Tracks the status of individual products assigned to a user within a drive session as part of a task set.';


--
-- Name: COLUMN drive_orders.task_set_product_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_orders.task_set_product_id IS 'References the specific product within a specific task set configuration.';


--
-- Name: COLUMN drive_orders.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_orders.status IS 'Status of this specific product task for the user in this session (e.g., pending, current, completed).';


--
-- Name: old_drive_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.old_drive_orders (
    id integer NOT NULL,
    session_id integer NOT NULL,
    product_id integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    tasks_required integer NOT NULL,
    order_in_drive integer
);


ALTER TABLE public.old_drive_orders OWNER TO postgres;

--
-- Name: drive_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_orders_id_seq OWNER TO postgres;

--
-- Name: drive_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_orders_id_seq OWNED BY public.old_drive_orders.id;


--
-- Name: drive_orders_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_orders_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_orders_id_seq1 OWNER TO postgres;

--
-- Name: drive_orders_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_orders_id_seq1 OWNED BY public.drive_orders.id;


--
-- Name: drive_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_combo_id integer,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp without time zone,
    status character varying(500) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    drive_type character varying(50) DEFAULT 'first'::character varying,
    tasks_completed integer DEFAULT 0,
    tasks_required integer,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    session_uuid uuid,
    frozen_amount_needed numeric,
    last_product_id integer,
    last_combo_id character varying(100),
    combo_progress jsonb,
    starting_balance numeric(12,2),
    commission_earned numeric(12,2) DEFAULT 0,
    drive_tasks jsonb,
    drive_configuration_id integer,
    current_task_set_id integer,
    current_task_set_product_id integer,
    current_user_active_drive_item_id integer,
    notes text,
    ended_at timestamp without time zone,
    CONSTRAINT drive_sessions_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('completed'::character varying)::text, ('frozen'::character varying)::text, ('pending_reset'::character varying)::text])))
);


ALTER TABLE public.drive_sessions OWNER TO postgres;

--
-- Name: COLUMN drive_sessions.tasks_completed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.tasks_completed IS 'Number of Task Sets already completed in this drive session.';


--
-- Name: COLUMN drive_sessions.tasks_required; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.tasks_required IS 'Total number of Task Sets required to complete this drive session.';


--
-- Name: COLUMN drive_sessions.current_task_set_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.current_task_set_id IS 'The ID of the Task Set the user is currently working on.';


--
-- Name: COLUMN drive_sessions.current_task_set_product_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.current_task_set_product_id IS 'The ID of the specific product (from drive_task_set_products) the user is currently working on within the current_task_set_id.';


--
-- Name: COLUMN drive_sessions.current_user_active_drive_item_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.current_user_active_drive_item_id IS 'FK to user_active_drive_items.id, indicating the current step in the active drive';


--
-- Name: COLUMN drive_sessions.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.notes IS 'Additional notes about the drive session';


--
-- Name: COLUMN drive_sessions.ended_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_sessions.ended_at IS 'Timestamp when the drive session was ended';


--
-- Name: drive_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_sessions_id_seq OWNER TO postgres;

--
-- Name: drive_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_sessions_id_seq OWNED BY public.drive_sessions.id;


--
-- Name: drive_task_set_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_task_set_products (
    id integer NOT NULL,
    task_set_id integer NOT NULL,
    product_id integer NOT NULL,
    order_in_set integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.drive_task_set_products OWNER TO postgres;

--
-- Name: TABLE drive_task_set_products; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.drive_task_set_products IS 'Drive task set products - commission rates calculated dynamically, no static overrides';


--
-- Name: COLUMN drive_task_set_products.order_in_set; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_task_set_products.order_in_set IS 'The sequential order of this product within its parent task set.';


--
-- Name: drive_task_set_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_task_set_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_task_set_products_id_seq OWNER TO postgres;

--
-- Name: drive_task_set_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_task_set_products_id_seq OWNED BY public.drive_task_set_products.id;


--
-- Name: drive_task_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_task_sets (
    id integer NOT NULL,
    drive_configuration_id integer NOT NULL,
    order_in_drive integer NOT NULL,
    name character varying(500),
    is_combo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.drive_task_sets OWNER TO postgres;

--
-- Name: TABLE drive_task_sets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.drive_task_sets IS 'Defines task sets within a drive configuration. A drive consists of an ordered sequence of these task sets.';


--
-- Name: COLUMN drive_task_sets.order_in_drive; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_task_sets.order_in_drive IS 'The sequential order of this task set within its drive configuration.';


--
-- Name: COLUMN drive_task_sets.is_combo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.drive_task_sets.is_combo IS 'Indicates if this task set is a combo (contains multiple products to be completed sequentially).';


--
-- Name: drive_task_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drive_task_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drive_task_sets_id_seq OWNER TO postgres;

--
-- Name: drive_task_sets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drive_task_sets_id_seq OWNED BY public.drive_task_sets.id;


--
-- Name: drives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drives (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    commission numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT drives_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.drives OWNER TO postgres;

--
-- Name: drives_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.drives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drives_id_seq OWNER TO postgres;

--
-- Name: drives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.drives_id_seq OWNED BY public.drives.id;


--
-- Name: general_notification_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.general_notification_reads (
    id integer NOT NULL,
    general_notification_id integer NOT NULL,
    user_id integer NOT NULL,
    read_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.general_notification_reads OWNER TO postgres;

--
-- Name: TABLE general_notification_reads; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.general_notification_reads IS 'Tracks which users have read which general notifications';


--
-- Name: general_notification_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.general_notification_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.general_notification_reads_id_seq OWNER TO postgres;

--
-- Name: general_notification_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.general_notification_reads_id_seq OWNED BY public.general_notification_reads.id;


--
-- Name: general_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.general_notifications (
    id integer NOT NULL,
    category_id integer NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    image_url character varying(500),
    is_active boolean DEFAULT true,
    priority integer DEFAULT 1,
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.general_notifications OWNER TO postgres;

--
-- Name: TABLE general_notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.general_notifications IS 'Public notifications visible to all users, managed by admins';


--
-- Name: COLUMN general_notifications.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.general_notifications.priority IS '1=Low, 2=Medium, 3=High priority';


--
-- Name: general_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.general_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.general_notifications_id_seq OWNER TO postgres;

--
-- Name: general_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.general_notifications_id_seq OWNED BY public.general_notifications.id;


--
-- Name: membership_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membership_tiers (
    id integer NOT NULL,
    tier_name character varying(50) NOT NULL,
    price_usd numeric(10,2) NOT NULL,
    commission_per_data_percent numeric(5,2) NOT NULL,
    commission_merge_data_percent numeric(5,2) NOT NULL,
    data_per_set_limit integer NOT NULL,
    sets_per_day_limit integer NOT NULL,
    withdrawal_limit_usd numeric(12,2),
    max_daily_withdrawals integer NOT NULL,
    handling_fee_percent numeric(5,2) DEFAULT 0.00 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.membership_tiers OWNER TO postgres;

--
-- Name: COLUMN membership_tiers.data_per_set_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.membership_tiers.data_per_set_limit IS 'Corresponds to "Limited to X data per set" from memberships.html; could be interpreted as tasks per drive/set.';


--
-- Name: COLUMN membership_tiers.sets_per_day_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.membership_tiers.sets_per_day_limit IS 'Corresponds to "X sets of data everyday" from memberships.html; could be interpreted as drives/sets per day.';


--
-- Name: COLUMN membership_tiers.withdrawal_limit_usd; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.membership_tiers.withdrawal_limit_usd IS 'NULL indicates an unlimited withdrawal limit.';


--
-- Name: COLUMN membership_tiers.max_daily_withdrawals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.membership_tiers.max_daily_withdrawals IS 'Interpreted from "X times of withdrawal" in memberships.html, assuming per day.';


--
-- Name: membership_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.membership_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.membership_tiers_id_seq OWNER TO postgres;

--
-- Name: membership_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.membership_tiers_id_seq OWNED BY public.membership_tiers.id;


--
-- Name: notification_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    color_code character varying(7) NOT NULL,
    icon character varying(50),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    color character varying(7) DEFAULT '#007bff'::character varying
);


ALTER TABLE public.notification_categories OWNER TO postgres;

--
-- Name: TABLE notification_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_categories IS 'Defines notification categories with color coding and icons';


--
-- Name: COLUMN notification_categories.color_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_categories.color_code IS 'Hex color code for UI display';


--
-- Name: notification_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_categories_id_seq OWNER TO postgres;

--
-- Name: notification_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_categories_id_seq OWNED BY public.notification_categories.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_read boolean DEFAULT false,
    category_id integer NOT NULL,
    title character varying(200),
    image_url character varying(500),
    priority integer DEFAULT 1,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: onboarding_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.onboarding_responses (
    id integer NOT NULL,
    user_id integer,
    email character varying(255),
    question_1 character varying(100),
    question_2 character varying(100),
    question_3 character varying(100),
    question_4 character varying(100),
    question_5 character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.onboarding_responses OWNER TO postgres;

--
-- Name: onboarding_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.onboarding_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.onboarding_responses_id_seq OWNER TO postgres;

--
-- Name: onboarding_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.onboarding_responses_id_seq OWNED BY public.onboarding_responses.id;


--
-- Name: product_combos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_combos (
    id integer NOT NULL,
    product_ids integer[] NOT NULL,
    combo_price numeric(10,2) NOT NULL,
    combo_commission_rate numeric(5,4) NOT NULL,
    min_balance_required numeric(10,2) DEFAULT 0,
    min_tier character varying(10) DEFAULT 'bronze'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_combos OWNER TO postgres;

--
-- Name: product_combos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_combos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_combos_id_seq OWNER TO postgres;

--
-- Name: product_combos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_combos_id_seq OWNED BY public.product_combos.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(500) NOT NULL,
    price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    image_url character varying(255),
    is_active boolean DEFAULT true,
    status character varying(20) DEFAULT 'active'::character varying,
    is_combo_only boolean DEFAULT false,
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying])::text[])))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: TABLE products; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.products IS 'Products table - commission rates are calculated dynamically based on user membership tiers';


--
-- Name: COLUMN products.is_combo_only; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.is_combo_only IS 'Indicates if this product can only be used in combo orders';


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_messages (
    id integer NOT NULL,
    sender_id integer NOT NULL,
    sender_role character varying(10) NOT NULL,
    recipient_id integer,
    subject character varying(255),
    message text NOT NULL,
    thread_id integer,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT support_messages_sender_role_check CHECK (((sender_role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.support_messages OWNER TO postgres;

--
-- Name: support_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_messages_id_seq OWNER TO postgres;

--
-- Name: support_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;


--
-- Name: tier_quantity_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tier_quantity_configs (
    id integer NOT NULL,
    tier_name character varying(50) NOT NULL,
    quantity_limit integer DEFAULT 40 NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    num_single_tasks integer DEFAULT 0,
    num_combo_tasks integer DEFAULT 0,
    min_price_single numeric(10,2) DEFAULT 0,
    max_price_single numeric(10,2) DEFAULT 100,
    min_price_combo numeric(10,2) DEFAULT 0,
    max_price_combo numeric(10,2) DEFAULT 500,
    commission_rate numeric(5,2) DEFAULT 5.0,
    description text DEFAULT ''::text,
    CONSTRAINT chk_quantity_limit CHECK ((quantity_limit > 0)),
    CONSTRAINT chk_tier_name_format CHECK (((length((tier_name)::text) > 0) AND (length((tier_name)::text) <= 50) AND ((tier_name)::text ~ '^[A-Za-z][A-Za-z0-9\s\-_]*$'::text)))
);


ALTER TABLE public.tier_quantity_configs OWNER TO postgres;

--
-- Name: COLUMN tier_quantity_configs.tier_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tier_quantity_configs.tier_name IS 'User tier name (Bronze, Silver, Gold, Platinum) - increased limit';


--
-- Name: tier_quantity_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tier_quantity_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tier_quantity_configs_id_seq OWNER TO postgres;

--
-- Name: tier_quantity_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tier_quantity_configs_id_seq OWNED BY public.tier_quantity_configs.id;


--
-- Name: user_active_drive_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_active_drive_items (
    id integer NOT NULL,
    user_id integer NOT NULL,
    drive_session_id integer NOT NULL,
    product_id_1 integer NOT NULL,
    product_id_2 integer,
    product_id_3 integer,
    order_in_drive integer NOT NULL,
    user_status character varying(10) DEFAULT 'PENDING'::character varying NOT NULL,
    task_type character varying(50) DEFAULT 'order'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    current_product_slot_processed integer DEFAULT 0 NOT NULL,
    drive_task_set_id_override integer,
    CONSTRAINT chk_user_status CHECK (((user_status)::text = ANY ((ARRAY['PENDING'::character varying, 'CURRENT'::character varying, 'COMPLETED'::character varying, 'SKIPPED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.user_active_drive_items OWNER TO postgres;

--
-- Name: COLUMN user_active_drive_items.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.user_id IS 'ID of the user this drive item belongs to';


--
-- Name: COLUMN user_active_drive_items.drive_session_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.drive_session_id IS 'FK to drive_sessions.id, identifying the user''s specific drive session.';


--
-- Name: COLUMN user_active_drive_items.product_id_1; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.product_id_1 IS 'Primary product for this drive step';


--
-- Name: COLUMN user_active_drive_items.product_id_2; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.product_id_2 IS 'Optional second product for a combo';


--
-- Name: COLUMN user_active_drive_items.product_id_3; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.product_id_3 IS 'Optional third product for a combo';


--
-- Name: COLUMN user_active_drive_items.order_in_drive; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.order_in_drive IS 'The sequence number of this item in the user"s active drive';


--
-- Name: COLUMN user_active_drive_items.user_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.user_status IS 'Status of this specific item for the user (e.g., PENDING, CURRENT, COMPLETED, SKIPPED, FAILED)';


--
-- Name: COLUMN user_active_drive_items.task_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_active_drive_items.task_type IS 'Type of task, e.g., "order", "survey"';


--
-- Name: user_active_drive_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_active_drive_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_active_drive_items_id_seq OWNER TO postgres;

--
-- Name: user_active_drive_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_active_drive_items_id_seq OWNED BY public.user_active_drive_items.id;


--
-- Name: user_drive_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_drive_configurations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    drive_configuration_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_drive_configurations OWNER TO postgres;

--
-- Name: user_drive_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_drive_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_drive_configurations_id_seq OWNER TO postgres;

--
-- Name: user_drive_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_drive_configurations_id_seq OWNED BY public.user_drive_configurations.id;


--
-- Name: user_drive_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_drive_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    date date NOT NULL,
    drives_completed integer DEFAULT 0,
    is_working_day boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_drive_progress OWNER TO postgres;

--
-- Name: user_drive_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_drive_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_drive_progress_id_seq OWNER TO postgres;

--
-- Name: user_drive_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_drive_progress_id_seq OWNED BY public.user_drive_progress.id;


--
-- Name: user_working_days; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_working_days (
    id integer NOT NULL,
    user_id integer NOT NULL,
    total_working_days integer DEFAULT 0,
    weekly_progress integer DEFAULT 0,
    last_reset_date date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_working_days OWNER TO postgres;

--
-- Name: user_working_days_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_working_days_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_working_days_id_seq OWNER TO postgres;

--
-- Name: user_working_days_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_working_days_id_seq OWNED BY public.user_working_days.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(100) NOT NULL,
    referral_code character varying(10) NOT NULL,
    upliner_id integer,
    tier character varying(50) DEFAULT 'bronze'::character varying,
    revenue_source character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    role character varying(10) DEFAULT 'user'::character varying,
    withdrawal_password_hash character varying(100),
    assigned_drive_configuration_id integer,
    balance numeric(15,2) DEFAULT 0.00,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.balance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.balance IS 'User current balance for balance-based filtering';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: withdrawal_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.withdrawal_addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    address_type character varying(10) DEFAULT 'TRC20'::character varying NOT NULL,
    address character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.withdrawal_addresses OWNER TO postgres;

--
-- Name: withdrawal_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.withdrawal_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.withdrawal_addresses_id_seq OWNER TO postgres;

--
-- Name: withdrawal_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.withdrawal_addresses_id_seq OWNED BY public.withdrawal_addresses.id;


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.withdrawals (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    address character varying(100) NOT NULL,
    txn_hash character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT withdrawals_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.withdrawals OWNER TO postgres;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.withdrawals_id_seq OWNER TO postgres;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: admin_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications ALTER COLUMN id SET DEFAULT nextval('public.admin_notifications_id_seq'::regclass);


--
-- Name: commission_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commission_logs ALTER COLUMN id SET DEFAULT nextval('public.commission_logs_id_seq'::regclass);


--
-- Name: deposit_qr_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposit_qr_codes ALTER COLUMN id SET DEFAULT nextval('public.deposit_qr_codes_id_seq'::regclass);


--
-- Name: deposits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits ALTER COLUMN id SET DEFAULT nextval('public.deposits_id_seq'::regclass);


--
-- Name: drive_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations ALTER COLUMN id SET DEFAULT nextval('public.drive_configurations_id_seq'::regclass);


--
-- Name: drive_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders ALTER COLUMN id SET DEFAULT nextval('public.drive_orders_id_seq1'::regclass);


--
-- Name: drive_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions ALTER COLUMN id SET DEFAULT nextval('public.drive_sessions_id_seq'::regclass);


--
-- Name: drive_task_set_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_set_products ALTER COLUMN id SET DEFAULT nextval('public.drive_task_set_products_id_seq'::regclass);


--
-- Name: drive_task_sets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_sets ALTER COLUMN id SET DEFAULT nextval('public.drive_task_sets_id_seq'::regclass);


--
-- Name: drives id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drives ALTER COLUMN id SET DEFAULT nextval('public.drives_id_seq'::regclass);


--
-- Name: general_notification_reads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notification_reads ALTER COLUMN id SET DEFAULT nextval('public.general_notification_reads_id_seq'::regclass);


--
-- Name: general_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notifications ALTER COLUMN id SET DEFAULT nextval('public.general_notifications_id_seq'::regclass);


--
-- Name: membership_tiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_tiers ALTER COLUMN id SET DEFAULT nextval('public.membership_tiers_id_seq'::regclass);


--
-- Name: notification_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories ALTER COLUMN id SET DEFAULT nextval('public.notification_categories_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: old_drive_configuration_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_configuration_items ALTER COLUMN id SET DEFAULT nextval('public.drive_configuration_items_id_seq'::regclass);


--
-- Name: old_drive_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_orders ALTER COLUMN id SET DEFAULT nextval('public.drive_orders_id_seq'::regclass);


--
-- Name: onboarding_responses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_responses ALTER COLUMN id SET DEFAULT nextval('public.onboarding_responses_id_seq'::regclass);


--
-- Name: product_combos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_combos ALTER COLUMN id SET DEFAULT nextval('public.product_combos_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: support_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);


--
-- Name: tier_quantity_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tier_quantity_configs ALTER COLUMN id SET DEFAULT nextval('public.tier_quantity_configs_id_seq'::regclass);


--
-- Name: user_active_drive_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items ALTER COLUMN id SET DEFAULT nextval('public.user_active_drive_items_id_seq'::regclass);


--
-- Name: user_drive_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_configurations ALTER COLUMN id SET DEFAULT nextval('public.user_drive_configurations_id_seq'::regclass);


--
-- Name: user_drive_progress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_progress ALTER COLUMN id SET DEFAULT nextval('public.user_drive_progress_id_seq'::regclass);


--
-- Name: user_working_days id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_working_days ALTER COLUMN id SET DEFAULT nextval('public.user_working_days_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: withdrawal_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_addresses ALTER COLUMN id SET DEFAULT nextval('public.withdrawal_addresses_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_user_id_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_type_key UNIQUE (user_id, type);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: chat_admin_logs chat_admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_admin_logs
    ADD CONSTRAINT chat_admin_logs_pkey PRIMARY KEY (id);


--
-- Name: chat_fake_users chat_fake_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_fake_users
    ADD CONSTRAINT chat_fake_users_pkey PRIMARY KEY (id);


--
-- Name: chat_group_members chat_group_members_group_id_fake_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_group_members
    ADD CONSTRAINT chat_group_members_group_id_fake_user_id_key UNIQUE (group_id, fake_user_id);


--
-- Name: chat_group_members chat_group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_group_members
    ADD CONSTRAINT chat_group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: chat_group_members chat_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_group_members
    ADD CONSTRAINT chat_group_members_pkey PRIMARY KEY (id);


--
-- Name: chat_groups chat_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_scheduled_messages chat_scheduled_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_scheduled_messages
    ADD CONSTRAINT chat_scheduled_messages_pkey PRIMARY KEY (id);


--
-- Name: commission_logs commission_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commission_logs
    ADD CONSTRAINT commission_logs_pkey PRIMARY KEY (id);


--
-- Name: deposit_qr_codes deposit_qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposit_qr_codes
    ADD CONSTRAINT deposit_qr_codes_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_pkey PRIMARY KEY (id);


--
-- Name: old_drive_configuration_items drive_configuration_items_drive_configuration_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_drive_configuration_id_product_id_key UNIQUE (drive_configuration_id, product_id, order_in_drive);


--
-- Name: old_drive_configuration_items drive_configuration_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_pkey PRIMARY KEY (id);


--
-- Name: drive_configurations drive_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations
    ADD CONSTRAINT drive_configurations_pkey PRIMARY KEY (id);


--
-- Name: old_drive_orders drive_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_orders
    ADD CONSTRAINT drive_orders_pkey PRIMARY KEY (id);


--
-- Name: drive_orders drive_orders_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT drive_orders_pkey1 PRIMARY KEY (id);


--
-- Name: drive_sessions drive_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_pkey PRIMARY KEY (id);


--
-- Name: drive_sessions drive_sessions_session_uuid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_session_uuid_key UNIQUE (session_uuid);


--
-- Name: drive_task_set_products drive_task_set_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_set_products
    ADD CONSTRAINT drive_task_set_products_pkey PRIMARY KEY (id);


--
-- Name: drive_task_sets drive_task_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_sets
    ADD CONSTRAINT drive_task_sets_pkey PRIMARY KEY (id);


--
-- Name: drives drives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_pkey PRIMARY KEY (id);


--
-- Name: general_notification_reads general_notification_reads_general_notification_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notification_reads
    ADD CONSTRAINT general_notification_reads_general_notification_id_user_id_key UNIQUE (general_notification_id, user_id);


--
-- Name: general_notification_reads general_notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notification_reads
    ADD CONSTRAINT general_notification_reads_pkey PRIMARY KEY (id);


--
-- Name: general_notifications general_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notifications
    ADD CONSTRAINT general_notifications_pkey PRIMARY KEY (id);


--
-- Name: membership_tiers membership_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_pkey PRIMARY KEY (id);


--
-- Name: membership_tiers membership_tiers_tier_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membership_tiers
    ADD CONSTRAINT membership_tiers_tier_name_key UNIQUE (tier_name);


--
-- Name: notification_categories notification_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories
    ADD CONSTRAINT notification_categories_name_key UNIQUE (name);


--
-- Name: notification_categories notification_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories
    ADD CONSTRAINT notification_categories_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_responses onboarding_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_responses
    ADD CONSTRAINT onboarding_responses_pkey PRIMARY KEY (id);


--
-- Name: product_combos product_combos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_combos
    ADD CONSTRAINT product_combos_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: tier_quantity_configs tier_quantity_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tier_quantity_configs
    ADD CONSTRAINT tier_quantity_configs_pkey PRIMARY KEY (id);


--
-- Name: tier_quantity_configs tier_quantity_configs_tier_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tier_quantity_configs
    ADD CONSTRAINT tier_quantity_configs_tier_name_key UNIQUE (tier_name);


--
-- Name: drive_task_sets uq_drive_config_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_sets
    ADD CONSTRAINT uq_drive_config_order UNIQUE (drive_configuration_id, order_in_drive);


--
-- Name: drive_orders uq_session_task_set_product; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT uq_session_task_set_product UNIQUE (session_id, task_set_product_id);


--
-- Name: drive_task_set_products uq_task_set_product_order; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_set_products
    ADD CONSTRAINT uq_task_set_product_order UNIQUE (task_set_id, order_in_set);


--
-- Name: user_active_drive_items user_active_drive_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT user_active_drive_items_pkey PRIMARY KEY (id);


--
-- Name: user_drive_configurations user_drive_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_configurations
    ADD CONSTRAINT user_drive_configurations_pkey PRIMARY KEY (id);


--
-- Name: user_drive_configurations user_drive_configurations_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_configurations
    ADD CONSTRAINT user_drive_configurations_user_id_key UNIQUE (user_id);


--
-- Name: user_drive_progress user_drive_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_progress
    ADD CONSTRAINT user_drive_progress_pkey PRIMARY KEY (id);


--
-- Name: user_drive_progress user_drive_progress_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_progress
    ADD CONSTRAINT user_drive_progress_user_id_date_key UNIQUE (user_id, date);


--
-- Name: user_working_days user_working_days_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_working_days
    ADD CONSTRAINT user_working_days_pkey PRIMARY KEY (id);


--
-- Name: user_working_days user_working_days_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_working_days
    ADD CONSTRAINT user_working_days_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: withdrawal_addresses withdrawal_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_addresses
    ADD CONSTRAINT withdrawal_addresses_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_addresses withdrawal_addresses_user_id_address_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_addresses
    ADD CONSTRAINT withdrawal_addresses_user_id_address_type_key UNIQUE (user_id, address_type);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: idx_chat_admin_logs_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_admin_logs_action_type ON public.chat_admin_logs USING btree (action_type);


--
-- Name: idx_chat_admin_logs_admin_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_admin_logs_admin_id ON public.chat_admin_logs USING btree (admin_id);


--
-- Name: idx_chat_admin_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_admin_logs_created_at ON public.chat_admin_logs USING btree (created_at);


--
-- Name: idx_chat_fake_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_fake_users_is_active ON public.chat_fake_users USING btree (is_active);


--
-- Name: idx_chat_group_members_fake_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_group_members_fake_user_id ON public.chat_group_members USING btree (fake_user_id);


--
-- Name: idx_chat_group_members_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_group_members_group_id ON public.chat_group_members USING btree (group_id);


--
-- Name: idx_chat_group_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_group_members_user_id ON public.chat_group_members USING btree (user_id);


--
-- Name: idx_chat_groups_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_groups_is_active ON public.chat_groups USING btree (is_active);


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- Name: idx_chat_messages_fake_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_fake_user_id ON public.chat_messages USING btree (fake_user_id);


--
-- Name: idx_chat_messages_group_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_group_id ON public.chat_messages USING btree (group_id);


--
-- Name: idx_chat_messages_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_user_id ON public.chat_messages USING btree (user_id);


--
-- Name: idx_chat_scheduled_messages_is_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_scheduled_messages_is_sent ON public.chat_scheduled_messages USING btree (is_sent);


--
-- Name: idx_chat_scheduled_messages_scheduled_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_scheduled_messages_scheduled_time ON public.chat_scheduled_messages USING btree (scheduled_time);


--
-- Name: idx_comm_logs_drive_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comm_logs_drive_session_id ON public.commission_logs USING btree (drive_session_id);


--
-- Name: idx_deposits_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deposits_status ON public.deposits USING btree (status);


--
-- Name: idx_deposits_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deposits_user_id ON public.deposits USING btree (user_id);


--
-- Name: idx_drive_configuration_items_drive_configuration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_configuration_items_drive_configuration_id ON public.old_drive_configuration_items USING btree (drive_configuration_id);


--
-- Name: idx_drive_configuration_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_configuration_items_product_id ON public.old_drive_configuration_items USING btree (product_id);


--
-- Name: idx_drive_configurations_associated_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_configurations_associated_user_id ON public.drive_configurations USING btree (associated_user_id);


--
-- Name: idx_drive_configurations_is_auto_generated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_configurations_is_auto_generated ON public.drive_configurations USING btree (is_auto_generated);


--
-- Name: idx_drive_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_session_id ON public.user_active_drive_items USING btree (drive_session_id);


--
-- Name: idx_drive_sessions_drive_configuration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_sessions_drive_configuration_id ON public.drive_sessions USING btree (drive_configuration_id);


--
-- Name: idx_drives_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drives_status ON public.drives USING btree (status);


--
-- Name: idx_drives_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drives_user_id ON public.drives USING btree (user_id);


--
-- Name: idx_general_notification_reads_notification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_general_notification_reads_notification ON public.general_notification_reads USING btree (general_notification_id);


--
-- Name: idx_general_notification_reads_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_general_notification_reads_user ON public.general_notification_reads USING btree (user_id);


--
-- Name: idx_general_notifications_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_general_notifications_active ON public.general_notifications USING btree (is_active);


--
-- Name: idx_general_notifications_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_general_notifications_category ON public.general_notifications USING btree (category_id);


--
-- Name: idx_general_notifications_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_general_notifications_dates ON public.general_notifications USING btree (start_date, end_date);


--
-- Name: idx_general_notifications_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_general_notifications_priority ON public.general_notifications USING btree (priority);


--
-- Name: idx_notifications_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_category ON public.notifications USING btree (category_id);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_onboarding_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_onboarding_created_at ON public.onboarding_responses USING btree (created_at);


--
-- Name: idx_onboarding_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_onboarding_email ON public.onboarding_responses USING btree (email);


--
-- Name: idx_onboarding_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_onboarding_user_id ON public.onboarding_responses USING btree (user_id);


--
-- Name: idx_products_is_combo_only; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_is_combo_only ON public.products USING btree (is_combo_only);


--
-- Name: idx_support_messages_recipient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_recipient_id ON public.support_messages USING btree (recipient_id);


--
-- Name: idx_support_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_sender_id ON public.support_messages USING btree (sender_id);


--
-- Name: idx_tier_quantity_configs_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tier_quantity_configs_active ON public.tier_quantity_configs USING btree (is_active);


--
-- Name: idx_tier_quantity_configs_tier_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tier_quantity_configs_tier_name ON public.tier_quantity_configs USING btree (tier_name);


--
-- Name: idx_user_drive_config_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_drive_config_user_id ON public.user_drive_configurations USING btree (user_id);


--
-- Name: idx_user_drive_progress_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_drive_progress_date ON public.user_drive_progress USING btree (date);


--
-- Name: idx_user_drive_progress_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_drive_progress_user_id ON public.user_drive_progress USING btree (user_id);


--
-- Name: idx_user_drive_session_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_drive_session_order ON public.user_active_drive_items USING btree (user_id, drive_session_id, order_in_drive);


--
-- Name: idx_user_working_days_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_working_days_user_id ON public.user_working_days USING btree (user_id);


--
-- Name: idx_users_balance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_balance ON public.users USING btree (balance);


--
-- Name: idx_users_tier_balance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tier_balance ON public.users USING btree (tier, balance);


--
-- Name: idx_withdrawals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawals_status ON public.withdrawals USING btree (status);


--
-- Name: idx_withdrawals_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawals_user_id ON public.withdrawals USING btree (user_id);


--
-- Name: drive_configurations trigger_drive_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_drive_configurations_updated_at BEFORE UPDATE ON public.drive_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_responses trigger_update_onboarding_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_onboarding_updated_at BEFORE UPDATE ON public.onboarding_responses FOR EACH ROW EXECUTE FUNCTION public.update_onboarding_updated_at();


--
-- Name: old_drive_configuration_items trigger_update_tasks_required_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_tasks_required_delete AFTER DELETE ON public.old_drive_configuration_items FOR EACH ROW EXECUTE FUNCTION public.update_drive_configuration_tasks_required();


--
-- Name: old_drive_configuration_items trigger_update_tasks_required_insert_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_tasks_required_insert_update AFTER INSERT OR UPDATE ON public.old_drive_configuration_items FOR EACH ROW EXECUTE FUNCTION public.update_drive_configuration_tasks_required();


--
-- Name: tier_quantity_configs trigger_update_tier_quantity_configs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_tier_quantity_configs_updated_at BEFORE UPDATE ON public.tier_quantity_configs FOR EACH ROW EXECUTE FUNCTION public.update_tier_quantity_configs_updated_at();


--
-- Name: user_active_drive_items trigger_update_user_active_drive_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_user_active_drive_items_updated_at BEFORE UPDATE ON public.user_active_drive_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deposits update_deposits_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: general_notifications update_general_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_general_notifications_updated_at BEFORE UPDATE ON public.general_notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_categories update_notification_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_categories_updated_at BEFORE UPDATE ON public.notification_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: withdrawals update_withdrawals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: admin_notifications admin_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chat_admin_logs chat_admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_admin_logs
    ADD CONSTRAINT chat_admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_fake_users chat_fake_users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_fake_users
    ADD CONSTRAINT chat_fake_users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chat_group_members chat_group_members_fake_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_group_members
    ADD CONSTRAINT chat_group_members_fake_user_id_fkey FOREIGN KEY (fake_user_id) REFERENCES public.chat_fake_users(id) ON DELETE CASCADE;


--
-- Name: chat_group_members chat_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_group_members
    ADD CONSTRAINT chat_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE;


--
-- Name: chat_group_members chat_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_group_members
    ADD CONSTRAINT chat_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_groups chat_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_groups
    ADD CONSTRAINT chat_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_fake_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_fake_user_id_fkey FOREIGN KEY (fake_user_id) REFERENCES public.chat_fake_users(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.chat_messages(id);


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_scheduled_messages chat_scheduled_messages_fake_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_scheduled_messages
    ADD CONSTRAINT chat_scheduled_messages_fake_user_id_fkey FOREIGN KEY (fake_user_id) REFERENCES public.chat_fake_users(id) ON DELETE CASCADE;


--
-- Name: chat_scheduled_messages chat_scheduled_messages_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_scheduled_messages
    ADD CONSTRAINT chat_scheduled_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.chat_groups(id) ON DELETE CASCADE;


--
-- Name: chat_scheduled_messages chat_scheduled_messages_scheduled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_scheduled_messages
    ADD CONSTRAINT chat_scheduled_messages_scheduled_by_fkey FOREIGN KEY (scheduled_by) REFERENCES public.users(id);


--
-- Name: chat_scheduled_messages chat_scheduled_messages_sent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_scheduled_messages
    ADD CONSTRAINT chat_scheduled_messages_sent_message_id_fkey FOREIGN KEY (sent_message_id) REFERENCES public.chat_messages(id);


--
-- Name: commission_logs commission_logs_source_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commission_logs
    ADD CONSTRAINT commission_logs_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES public.users(id);


--
-- Name: commission_logs commission_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commission_logs
    ADD CONSTRAINT commission_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: deposits deposits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: old_drive_configuration_items drive_configuration_items_drive_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_drive_configuration_id_fkey FOREIGN KEY (drive_configuration_id) REFERENCES public.drive_configurations(id) ON DELETE CASCADE;


--
-- Name: old_drive_configuration_items drive_configuration_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: drive_configurations drive_configurations_associated_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations
    ADD CONSTRAINT drive_configurations_associated_user_id_fkey FOREIGN KEY (associated_user_id) REFERENCES public.users(id);


--
-- Name: drive_configurations drive_configurations_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations
    ADD CONSTRAINT drive_configurations_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.users(id);


--
-- Name: old_drive_orders drive_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_orders
    ADD CONSTRAINT drive_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: old_drive_orders drive_orders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.old_drive_orders
    ADD CONSTRAINT drive_orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.drive_sessions(id);


--
-- Name: drive_orders drive_orders_session_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT drive_orders_session_id_fkey1 FOREIGN KEY (session_id) REFERENCES public.drive_sessions(id) ON DELETE CASCADE;


--
-- Name: drive_orders drive_orders_task_set_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT drive_orders_task_set_product_id_fkey FOREIGN KEY (task_set_product_id) REFERENCES public.drive_task_set_products(id) ON DELETE CASCADE;


--
-- Name: drive_sessions drive_sessions_current_task_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_current_task_set_id_fkey FOREIGN KEY (current_task_set_id) REFERENCES public.drive_task_sets(id) ON DELETE SET NULL;


--
-- Name: drive_sessions drive_sessions_current_task_set_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_current_task_set_product_id_fkey FOREIGN KEY (current_task_set_product_id) REFERENCES public.drive_task_set_products(id) ON DELETE SET NULL;


--
-- Name: drive_sessions drive_sessions_drive_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_drive_configuration_id_fkey FOREIGN KEY (drive_configuration_id) REFERENCES public.drive_configurations(id) ON DELETE SET NULL;


--
-- Name: drive_sessions drive_sessions_product_combo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_product_combo_id_fkey FOREIGN KEY (product_combo_id) REFERENCES public.product_combos(id) ON DELETE SET NULL;


--
-- Name: drive_sessions drive_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT drive_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: drive_task_set_products drive_task_set_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_set_products
    ADD CONSTRAINT drive_task_set_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: drive_task_set_products drive_task_set_products_task_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_set_products
    ADD CONSTRAINT drive_task_set_products_task_set_id_fkey FOREIGN KEY (task_set_id) REFERENCES public.drive_task_sets(id) ON DELETE CASCADE;


--
-- Name: drive_task_sets drive_task_sets_drive_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_task_sets
    ADD CONSTRAINT drive_task_sets_drive_configuration_id_fkey FOREIGN KEY (drive_configuration_id) REFERENCES public.drive_configurations(id) ON DELETE CASCADE;


--
-- Name: drives drives_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: drives drives_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: drive_sessions fk_current_user_active_drive_item; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions
    ADD CONSTRAINT fk_current_user_active_drive_item FOREIGN KEY (current_user_active_drive_item_id) REFERENCES public.user_active_drive_items(id) ON DELETE SET NULL;


--
-- Name: user_active_drive_items fk_drive_task_set_id_override; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT fk_drive_task_set_id_override FOREIGN KEY (drive_task_set_id_override) REFERENCES public.drive_task_sets(id) ON DELETE SET NULL;


--
-- Name: users fk_users_assigned_drive_configuration; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_assigned_drive_configuration FOREIGN KEY (assigned_drive_configuration_id) REFERENCES public.drive_configurations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: general_notification_reads general_notification_reads_general_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notification_reads
    ADD CONSTRAINT general_notification_reads_general_notification_id_fkey FOREIGN KEY (general_notification_id) REFERENCES public.general_notifications(id) ON DELETE CASCADE;


--
-- Name: general_notification_reads general_notification_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notification_reads
    ADD CONSTRAINT general_notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: general_notifications general_notifications_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notifications
    ADD CONSTRAINT general_notifications_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.notification_categories(id);


--
-- Name: general_notifications general_notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.general_notifications
    ADD CONSTRAINT general_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: notifications notifications_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.notification_categories(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: onboarding_responses onboarding_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.onboarding_responses
    ADD CONSTRAINT onboarding_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: support_messages support_messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: support_messages support_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: support_messages support_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.support_messages(id);


--
-- Name: user_active_drive_items user_active_drive_items_drive_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT user_active_drive_items_drive_session_id_fkey FOREIGN KEY (drive_session_id) REFERENCES public.drive_sessions(id) ON DELETE CASCADE;


--
-- Name: user_active_drive_items user_active_drive_items_product_id_1_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT user_active_drive_items_product_id_1_fkey FOREIGN KEY (product_id_1) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: user_active_drive_items user_active_drive_items_product_id_2_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT user_active_drive_items_product_id_2_fkey FOREIGN KEY (product_id_2) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: user_active_drive_items user_active_drive_items_product_id_3_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT user_active_drive_items_product_id_3_fkey FOREIGN KEY (product_id_3) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: user_active_drive_items user_active_drive_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_active_drive_items
    ADD CONSTRAINT user_active_drive_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_drive_configurations user_drive_configurations_drive_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_configurations
    ADD CONSTRAINT user_drive_configurations_drive_configuration_id_fkey FOREIGN KEY (drive_configuration_id) REFERENCES public.drive_configurations(id) ON DELETE CASCADE;


--
-- Name: user_drive_configurations user_drive_configurations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_drive_configurations
    ADD CONSTRAINT user_drive_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_upliner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_upliner_id_fkey FOREIGN KEY (upliner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: withdrawal_addresses withdrawal_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_addresses
    ADD CONSTRAINT withdrawal_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

