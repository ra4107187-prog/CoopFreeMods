const estilosCSS = `<style>

    /* Scrollbar al estilo de la web */
    html {
        scrollbar-width: thin;
        scrollbar-color: #e11d48 #161920;
    }
    ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
    }
    ::-webkit-scrollbar-track {
        background: #161920;
    }
    ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #ff3333, #b91c1c);
        border-radius: 8px;
        border: 2px solid #161920;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #ff5555, #dc2626);
    }
    ::-webkit-scrollbar-corner {
        background: #161920;
    }
    body {
        background-image: url('/public/fondo.jpg') !important;
        background-repeat: repeat !important;
        background-color: #111319;
        color: #f1f3f5;
        font-family: sans-serif;
        margin: 0; padding: 0;
    }
    .navbar {
        background-image: url('/public/navbar-bg.png');
        background-size: 300px auto !important;
        background-position: center top;
        background-repeat: no-repeat;
        background-color: #1a6bdb;
        padding: 8px 40px 14px;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        border-bottom: 3px solid #ff3333;
        min-height: 56px;
        height: auto;
        overflow: visible;
        position: relative;
        gap: 0;
    }
    .navbar-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 16px;
        position: relative;
        z-index: 1;
        width: 100%;
    }
    .navbar-row-main {
        padding-bottom: 2px;
    }
    .navbar-row-sub {
        min-height: 0;
        padding: 0;
        border-top: none;
        margin-top: -4px;
    }
    .navbar-row-sub:not(:has(a)) {
        display: none;
    }
    .navbar::before {
        content: '';
        position: absolute; inset: 0;
        background: rgba(0, 20, 50, 0.35);
        pointer-events: none;
        z-index: 0;
    }
    .navbar > * { position: relative; z-index: 1; }
    .nav-links a { color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
    .nav-links a:hover { color: #ffe566; }
    .brand-logo {
        height: 72px;
        max-height: 72px;
        width: auto;
        display: block;
        object-fit: contain;
        margin: -12px 0;
    }
    .brand {
        display: flex;
        align-items: center;
        height: 56px;
        overflow: visible;
    }
    .nav-links {
        display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap;
        flex: 1 1 auto; justify-content: flex-end; max-width: 100%;
        row-gap: 6px;
    }
    .nav-links-sub {
        justify-content: center;
        width: 100%;
        padding: 0 0 4px;
        gap: 10px 16px;
        margin-top: -2px;
    }
    .nav-links a { color: #ced4da; text-decoration: none; font-weight: bold; font-size: 14px; white-space: nowrap; }
    .nav-links a:hover { color: white; }
    @media (max-width: 1100px) {
        .navbar-row-main { flex-direction: column; align-items: stretch; }
        .nav-links-main { justify-content: center; }
        .brand { justify-content: center; }
    }
    .btn-red { background-color: #ff3333; color: white!important; padding: 8px 16px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; }
    .btn-blue { background-color: #2563eb; color: white!important; padding: 8px 20px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; }
    .btn-green { background-color: #16a34a; color: white!important; padding: 6px 12px; border-radius: 6px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; font-size: 13px; }
    .btn-gray { background-color: #4b5563; color: white!important; padding: 4px 10px; border-radius: 4px; font-size: 12px; text-decoration: none; border: none; cursor: pointer; }
    .btn-delete { background-color: #dc2626; color: white!important; padding: 4px 8px; border-radius: 4px; font-size: 11px; text-decoration: none; border: none; cursor: pointer; }
    .btn-like { color: #9ca3af; text-decoration: none; }
    .btn-like.active { color: #facc15; }
    .main-container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    .filter-bar {
        background-color: rgba(31, 35, 43, 0.9);
        padding: 15px;
        border-radius: 12px;
        display: flex;
        gap: 10px;
        align-items: center;
        border: 1px solid #2d3139;
        margin-bottom: 25px;
        flex-wrap: wrap;
    }
    .filter-bar input[type="text"] {
        background: #161920; border: 1px solid #374151; color: white;
        padding: 8px 12px; border-radius: 6px; flex: 1; min-width: 160px;
        width: auto; margin-bottom: 0;
    }
    .filter-bar select {
        background: #161920; border: 1px solid #374151; color: white;
        padding: 8px 12px; border-radius: 6px; width: auto; margin-bottom: 0;
        min-width: 140px;
    }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .card { background-color: rgba(31, 35, 43, 0.93); border-radius: 12px; overflow: hidden; border: 1px solid #2d3139; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; flex-direction: column; backdrop-filter: blur(3px); transition: transform 0.18s ease, box-shadow 0.18s ease; }
    .card:hover { transform: translateY(-6px); box-shadow: 0 10px 24px rgba(0,0,0,0.55); border-color: #3d4450; }
    .card-img-box { height: 140px; background-color: #161920; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .card-img-box img { width: 100%; height: 100%; object-fit: cover; }
    .card-content { padding: 15px; flex-grow: 1; }
    .tags { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    .tag-version { background-color: #2e3545; color: #93c5fd; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    .tag-category { background-color: #374151; color: #d1d5db; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .card h3 { margin: 0 0 10px 0; font-size: 16px; }
    .card h3 a { color: white; text-decoration: none; }
    .card h3 a:hover { color: #e5e7eb; text-decoration: underline; }
    .card p { color: #9ca3af; font-size: 12px; height: 35px; overflow: hidden; margin: 0 0 15px 0; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #2d3139; padding-top: 12px; margin-top: auto; }
    .author { color: white; text-decoration: none; font-weight: bold; }
    .author:hover { color: #e5e7eb; }
    .info-box { background-color: rgba(31, 35, 43, 0.9); border: 1px solid #2d3139; border-radius: 12px; padding: 25px; margin-bottom: 25px; }
    .info-box h2 { margin: 0 0 15px 0; font-size: 18px; color: white; border-bottom: 1px solid #2d3139; padding-bottom: 10px; }
    .info-box p { color: #ced4da; font-size: 14px; white-space: pre-wrap; }
    .form-box { background-color: rgba(31, 35, 43, 0.9); max-width: 500px; margin: 50px auto; padding: 30px; border-radius: 12px; border: 1px solid #2d3139; }
    input, select, textarea { width: 100%; padding: 10px; margin-bottom: 15px; background-color: #161920; border: 1px solid #374151; color: white; border-radius: 6px; box-sizing: border-box; }
    .profile-header { background: rgba(22, 25, 32, 0.9); border: 1px solid #2d3139; border-radius: 12px; padding: 30px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .meta-table td { padding: 8px; border-bottom: 1px solid #2d3139; font-size: 14px; }
    .meta-table td:first-child { color: #9ca3af; font-weight: bold; width: 40%; }
    .changelog-item { background: #161920; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; border-left: 3px solid #ff3333; }
    .mod-gallery-preview img { width: 100%; max-width: 600px; height: auto; border-radius: 8px; border: 1px solid #374151; display: block; object-fit: contain; margin-top: 10px; }
    .top-badge { background: #facc15; color: #111319; font-weight: bold; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
    .error-msg { color: #f87171; text-align: center; margin: 20px; }
    .comment-box { background:#161920; border:1px solid #2d3139; border-radius:8px; padding:12px; margin-bottom:10px; }
    .comment-reply { margin-left: 20px; border-left: 2px solid #374151; padding-left: 10px; margin-top: 6px; font-size: 12px; opacity: 0.95; }
    .notif-badge { background:#ff3333; color:white; font-size:11px; padding:1px 6px; border-radius:10px; margin-left:4px; }
    .notif-bell { position: relative; display: inline-block; }
    .notif-dot {
        position: absolute; top: -2px; right: -4px;
        width: 8px; height: 8px; background: #ff3333;
        border-radius: 50%; border: 1.5px solid #0f1115;
        pointer-events: none;
    }
    .notif-item { background:#161920; border:1px solid #2d3139; border-radius:8px; padding:12px; margin-bottom:8px; }
    .notif-item.unread { border-left: 3px solid #ff3333; }
    .mod-badge { background:#7c3aed; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; }
    .banned-badge { background:#dc2626; color:white; font-size:10px; padding:2px 6px; border-radius:4px; }

    .filter-bar {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 10px !important;
        background-color: rgba(31, 35, 43, 0.95) !important;
        padding: 12px 16px !important;
        border-radius: 12px !important;
        border: 1px solid #2d3139 !important;
        margin-bottom: 25px !important;
        overflow-x: auto;
    }
    .filter-bar input[type="text"] {
        flex: 1 1 auto !important;
        width: auto !important;
        min-width: 180px !important;
        margin-bottom: 0 !important;
        background: #161920 !important;
        border: 1px solid #374151 !important;
        color: white !important;
        padding: 10px 14px !important;
        border-radius: 8px !important;
    }
    .filter-bar select {
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 140px !important;
        margin-bottom: 0 !important;
        background: #161920 !important;
        border: 1px solid #374151 !important;
        color: white !important;
        padding: 10px 12px !important;
        border-radius: 8px !important;
    }
    .filter-bar button {
        flex: 0 0 auto !important;
        margin-bottom: 0 !important;
        white-space: nowrap;
    }

    .discord-float {
        display: inline-block;
        margin: 40px 20px 30px auto;
        background: #5865F2;
        color: white !important;
        font-weight: 800;
        font-size: 14px;
        padding: 12px 18px;
        border-radius: 999px;
        text-decoration: none;
        box-shadow: 0 6px 20px rgba(88, 101, 242, 0.45);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .discord-float-wrap {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px 30px;
        display: flex;
        justify-content: flex-end;
    }
    .discord-float:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 28px rgba(88, 101, 242, 0.6);
        color: white !important;
    }

    @media (max-width: 768px) {
        .navbar {
            padding: 10px 12px !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 8px !important;
            min-height: auto !important;
        }
        .brand-logo {
            height: 48px !important;
            max-height: 48px !important;
            margin: 0 !important;
        }
        .brand { height: auto !important; justify-content: center; }
        .nav-links {
            justify-content: center;
            gap: 10px 12px !important;
            font-size: 13px;
        }
        .nav-links a { font-size: 13px !important; }
        .main-container {
            margin: 16px auto !important;
            padding: 0 12px !important;
        }
        .filter-bar {
            flex-wrap: wrap !important;
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px !important;
            gap: 8px !important;
        }
        .filter-bar input[type="text"],
        .filter-bar select,
        .filter-bar button {
            width: 100% !important;
            min-width: 0 !important;
            flex: none !important;
            box-sizing: border-box !important;
        }
        .grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
        }
        .card-img-box { height: 180px !important; }
        .card h3 { font-size: 17px !important; }
        .form-box {
            margin: 20px 12px !important;
            padding: 20px !important;
            max-width: none !important;
        }
        .discord-float-wrap {
            justify-content: center !important;
            padding: 16px 12px 28px !important;
        }
        .discord-float {
            width: 100%;
            text-align: center;
            box-sizing: border-box;
        }
        .info-box { padding: 16px !important; }
        h1 { font-size: 1.5rem !important; }
        h2 { font-size: 1.2rem !important; }
    }
    @media (min-width: 769px) and (max-width: 1024px) {
        .grid {
            grid-template-columns: repeat(2, 1fr) !important;
        }
        .navbar { padding: 10px 20px !important; }
    }

    .home-page { max-width: 1100px; }
    .home-grid {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 24px;
        align-items: start;
    }
    .home-hero {
        background: rgba(31, 35, 43, 0.92);
        border: 1px solid #2d3139;
        border-radius: 14px;
        padding: 28px 28px 22px;
        margin-bottom: 22px;
    }
    .home-hero h1 {
        margin: 0 0 12px 0;
        font-size: 1.85rem;
        color: white;
        line-height: 1.25;
    }
    .home-accent { color: #ff6b6b; }
    .home-lead {
        color: #ced4da;
        font-size: 15px;
        line-height: 1.55;
        margin: 0 0 10px 0;
    }
    .home-section {
        background: rgba(31, 35, 43, 0.9);
        border: 1px solid #2d3139;
        border-radius: 12px;
        padding: 18px;
        margin-bottom: 18px;
    }
    .home-section h2 {
        margin: 0 0 14px 0;
        font-size: 1.1rem;
        color: white;
        border-bottom: 1px solid #2d3139;
        padding-bottom: 8px;
    }
    .home-side-box {
        background: rgba(31, 35, 43, 0.92);
        border: 1px solid #2d3139;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
    }
    .home-side-box h3 {
        margin: 0 0 12px 0;
        font-size: 0.95rem;
        color: white;
    }
    .home-cats { display: flex; flex-wrap: wrap; gap: 8px; }
    .home-cat {
        background: #1f2937;
        color: #e5e7eb !important;
        text-decoration: none;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid #374151;
    }
    .home-cat:hover { background: #2563eb; border-color: #2563eb; color: white !important; }
    .home-list { display: flex; flex-direction: column; gap: 8px; }
    .home-mod-row, .home-foro-row {
        display: flex;
        gap: 10px;
        align-items: center;
        text-decoration: none;
        color: inherit;
        background: #161920;
        border-radius: 8px;
        padding: 8px;
        border: 1px solid #2d3139;
    }
    .home-mod-row:hover, .home-foro-row:hover { border-color: #4b5563; }
    .home-mod-thumb {
        width: 52px; height: 52px;
        border-radius: 6px;
        overflow: hidden;
        background: #0f1115;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
    }
    .home-mod-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .home-mod-ph { font-size: 22px; }
    .home-mod-title, .home-foro-title {
        color: white;
        font-weight: 700;
        font-size: 13px;
        line-height: 1.3;
    }
    .home-mod-meta, .home-foro-meta {
        color: #9ca3af;
        font-size: 11px;
        margin-top: 2px;
        display: block;
    }
    .home-foro-row { flex-direction: column; align-items: flex-start; gap: 2px; }
    .home-cta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        margin: 28px 0 40px;
        padding: 20px;
        background: rgba(31, 35, 43, 0.9);
        border-radius: 12px;
        border: 1px solid #2d3139;
    }
    .home-cta a { text-align: center; }
    .comment-box p, .comment-reply p {
        white-space: normal !important;
        word-break: break-word;
        max-height: none;
    }
    @media (max-width: 768px) {
        .home-grid { grid-template-columns: 1fr !important; }
        .home-hero h1 { font-size: 1.4rem !important; }
        .home-cta { flex-direction: column; }
        .home-cta a { width: 100%; box-sizing: border-box; }
    }

    html.cfm-sm64-cursor,
    html.cfm-sm64-cursor *,
    html.cfm-sm64-cursor a,
    html.cfm-sm64-cursor a:hover,
    html.cfm-sm64-cursor a:active,
    html.cfm-sm64-cursor button,
    html.cfm-sm64-cursor button:hover,
    html.cfm-sm64-cursor input,
    html.cfm-sm64-cursor input:hover,
    html.cfm-sm64-cursor input:focus,
    html.cfm-sm64-cursor textarea,
    html.cfm-sm64-cursor textarea:hover,
    html.cfm-sm64-cursor textarea:focus,
    html.cfm-sm64-cursor select,
    html.cfm-sm64-cursor label,
    html.cfm-sm64-cursor summary,
    html.cfm-sm64-cursor [onclick],
    html.cfm-sm64-cursor .btn-red,
    html.cfm-sm64-cursor .btn-blue,
    html.cfm-sm64-cursor .btn-gray,
    html.cfm-sm64-cursor .btn-like,
    html.cfm-sm64-cursor .card,
    html.cfm-sm64-cursor .discord-float {
        cursor: url('/public/cursor.png') 10 10, auto !important;
    }
    .config-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid #2d3139;
        cursor: pointer;
    }
    .config-row input { margin: 0; }

    /* Vista lista (config) */
    html.cfm-list-view .grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
    }
    html.cfm-list-view .grid .card {
        flex-direction: row !important;
        align-items: stretch !important;
        min-height: 0 !important;
        transform: none !important;
    }
    html.cfm-list-view .grid .card:hover {
        transform: translateY(-2px) !important;
    }
    html.cfm-list-view .grid .card > a {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        flex: 1 !important;
        min-width: 0 !important;
        gap: 12px !important;
        padding: 8px 10px !important;
    }
    html.cfm-list-view .grid .card-img-box {
        width: 64px !important;
        height: 64px !important;
        min-width: 64px !important;
        border-radius: 8px !important;
        margin: 0 !important;
        flex-shrink: 0 !important;
    }
    html.cfm-list-view .grid .card-content {
        padding: 0 !important;
        flex: 1 !important;
        min-width: 0 !important;
    }
    html.cfm-list-view .grid .card-content .tags {
        display: none !important;
    }
    html.cfm-list-view .grid .card-content h3 {
        font-size: 15px !important;
        margin: 0 0 4px 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }
    html.cfm-list-view .grid .card-content p {
        display: none !important;
    }
    html.cfm-list-view .grid .card-footer {
        flex-direction: column !important;
        justify-content: center !important;
        align-items: flex-end !important;
        padding: 8px 14px !important;
        margin: 0 !important;
        border-top: none !important;
        border-left: 1px solid #2d3139 !important;
        white-space: nowrap !important;
        gap: 4px !important;
    }
    html.cfm-list-view .grid .card-footer > span:first-child {
        font-size: 12px !important;
    }
</style>`;

module.exports = { estilosCSS };
