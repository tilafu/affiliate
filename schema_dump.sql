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
-- Name: commission_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commission_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    source_user_id integer,
    source_action_id integer,
    account_type character varying(10),
    commission_amount numeric(12,2) NOT NULL,
    commission_type character varying(20) NOT NULL,
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
-- Name: drive_configuration_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_configuration_items (
    id integer NOT NULL,
    drive_configuration_id integer NOT NULL,
    product_id integer NOT NULL,
    order_in_drive integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.drive_configuration_items OWNER TO postgres;

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

ALTER SEQUENCE public.drive_configuration_items_id_seq OWNED BY public.drive_configuration_items.id;


--
-- Name: drive_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_configurations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_by_admin_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tasks_required integer NOT NULL,
    CONSTRAINT tasks_required_positive CHECK ((tasks_required > 0))
);


ALTER TABLE public.drive_configurations OWNER TO postgres;

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
    product_id integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    tasks_required integer NOT NULL,
    order_in_drive integer
);


ALTER TABLE public.drive_orders OWNER TO postgres;

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

ALTER SEQUENCE public.drive_orders_id_seq OWNED BY public.drive_orders.id;


--
-- Name: drive_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_combo_id integer,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp without time zone,
    status character varying(20) DEFAULT 'active'::character varying,
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
    CONSTRAINT drive_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'frozen'::character varying, 'pending_reset'::character varying])::text[])))
);


ALTER TABLE public.drive_sessions OWNER TO postgres;

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
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_read boolean DEFAULT false
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
    is_active boolean DEFAULT true
);


ALTER TABLE public.products OWNER TO postgres;

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
    tier character varying(10) DEFAULT 'bronze'::character varying,
    revenue_source character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    role character varying(10) DEFAULT 'user'::character varying,
    withdrawal_password_hash character varying(100),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

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
-- Name: deposits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits ALTER COLUMN id SET DEFAULT nextval('public.deposits_id_seq'::regclass);


--
-- Name: drive_configuration_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configuration_items ALTER COLUMN id SET DEFAULT nextval('public.drive_configuration_items_id_seq'::regclass);


--
-- Name: drive_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations ALTER COLUMN id SET DEFAULT nextval('public.drive_configurations_id_seq'::regclass);


--
-- Name: drive_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders ALTER COLUMN id SET DEFAULT nextval('public.drive_orders_id_seq'::regclass);


--
-- Name: drive_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_sessions ALTER COLUMN id SET DEFAULT nextval('public.drive_sessions_id_seq'::regclass);


--
-- Name: drives id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drives ALTER COLUMN id SET DEFAULT nextval('public.drives_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


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
-- Name: commission_logs commission_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commission_logs
    ADD CONSTRAINT commission_logs_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_pkey PRIMARY KEY (id);


--
-- Name: drive_configuration_items drive_configuration_items_drive_configuration_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_drive_configuration_id_product_id_key UNIQUE (drive_configuration_id, product_id, order_in_drive);


--
-- Name: drive_configuration_items drive_configuration_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_pkey PRIMARY KEY (id);


--
-- Name: drive_configurations drive_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations
    ADD CONSTRAINT drive_configurations_pkey PRIMARY KEY (id);


--
-- Name: drive_orders drive_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT drive_orders_pkey PRIMARY KEY (id);


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
-- Name: drives drives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


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

CREATE INDEX idx_drive_configuration_items_drive_configuration_id ON public.drive_configuration_items USING btree (drive_configuration_id);


--
-- Name: idx_drive_configuration_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_configuration_items_product_id ON public.drive_configuration_items USING btree (product_id);


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
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_support_messages_recipient_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_recipient_id ON public.support_messages USING btree (recipient_id);


--
-- Name: idx_support_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_messages_sender_id ON public.support_messages USING btree (sender_id);


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
-- Name: idx_user_working_days_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_working_days_user_id ON public.user_working_days USING btree (user_id);


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
-- Name: drive_configuration_items trigger_update_tasks_required_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_tasks_required_delete AFTER DELETE ON public.drive_configuration_items FOR EACH ROW EXECUTE FUNCTION public.update_drive_configuration_tasks_required();


--
-- Name: drive_configuration_items trigger_update_tasks_required_insert_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_tasks_required_insert_update AFTER INSERT OR UPDATE ON public.drive_configuration_items FOR EACH ROW EXECUTE FUNCTION public.update_drive_configuration_tasks_required();


--
-- Name: deposits update_deposits_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


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
-- Name: drive_configuration_items drive_configuration_items_drive_configuration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_drive_configuration_id_fkey FOREIGN KEY (drive_configuration_id) REFERENCES public.drive_configurations(id) ON DELETE CASCADE;


--
-- Name: drive_configuration_items drive_configuration_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configuration_items
    ADD CONSTRAINT drive_configuration_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: drive_configurations drive_configurations_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_configurations
    ADD CONSTRAINT drive_configurations_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.users(id);


--
-- Name: drive_orders drive_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT drive_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: drive_orders drive_orders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_orders
    ADD CONSTRAINT drive_orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.drive_sessions(id);


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
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


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

