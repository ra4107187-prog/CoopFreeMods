const estilosCSS = `<style>

    /* Scrollbar al estilo de la web */
    html {
        scrollbar-width: thin;
        scrollbar-color: #e11d48 #161920; 
    }
    ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
    }
    ::-webkit-scrollbar-track {
        background: #161920;
        
    }
    ::-webkit-scrollbar-thumb {
        background-color: #e11d48;
        border-radius: 6px;
        border: 2px solid #161920;
        
    }
    ::-webkit-scrollbar-thumb:hover {
        background-color: #ff4444;
        filter: brightness(1.15);
    }
    ::-webkit-scrollbar-corner {
        background: #161920;
    }
    body {
        background-image: url('/public/fondo.jpg') !important;
        background-repeat: repeat !important;
        background-size: 995px auto !important;
        background-position: top left !important;
        background-color: #111319;
        color: #f1f3f5;
        font-family: sans-serif;
        margin: 0; padding: 0;
    }
    .navbar {
        background-image: url('/public/navbar-bg.png');
        background-size: cover;
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
        padding-bottom: 4px;
        flex-wrap: nowrap;
    }
    .navbar-row-sub {
        min-height: 0;
        padding: 2px 0 6px;
        border-top: none;
        margin-top: 0;
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
    .nav-links a:hover { color: #ffe566; transform: scale(1.1); }
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
        display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap;
        flex: 1 1 auto; justify-content: flex-end; max-width: 100%;
        row-gap: 6px;
    }
    .nav-links-main {
        justify-content: flex-end;
    }
    .nav-links-sub {
        justify-content: center;
        width: 100%;
        padding: 0;
        gap: 10px 14px;
        margin-top: 0;
    }
    .nav-links a { color: #ced4da; text-decoration: none; font-weight: bold; font-size: 13px; white-space: nowrap; }
    .nav-links a { display: inline-block; transition: color 0.15s ease, transform 0.15s ease; }
    .nav-links a:hover { color: white; transform: scale(1.12); }
    @media (max-width: 1100px) {
        .navbar-row-main { flex-direction: column; align-items: stretch; flex-wrap: wrap; }
        .nav-links-main { justify-content: center; }
        .brand { justify-content: center; height: auto; }
        .brand-logo { margin: 0 auto; }
    }
    @media (max-width: 768px) {
        .nav-links a { font-size: 12px; }
        .navbar { padding: 8px 12px 10px !important; }
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
    .card { background-color: rgba(31, 35, 43, 0.93); border-radius: 12px; overflow: hidden; border: 1px solid #2d3139; box-shadow: 0 6px 16px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.3); display: flex; flex-direction: column; backdrop-filter: blur(3px); transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .card:hover { transform: translateY(-10px) scale(1.035); box-shadow: 0 18px 36px rgba(0,0,0,0.6), 0 6px 12px rgba(0,0,0,0.35); border-color: #4b5563; z-index: 2; }
    .card.card-mod-semana {
      border: 2px solid #f5c542 !important;
      background: linear-gradient(165deg, rgba(61,48,16,0.95) 0%, rgba(31,35,43,0.98) 55%) !important;
      box-shadow: 0 0 0 1px rgba(245,197,66,0.35), 0 8px 28px rgba(245,197,66,0.18);
      transition: transform 0.2s ease, box-shadow 0.25s ease, border-color 0.25s ease, filter 0.25s ease;
    }
    .card.card-mod-semana:hover {
      transform: translateY(-8px) scale(1.02);
      border-color: #ffe08a !important;
      box-shadow:
        0 0 12px 2px rgba(245, 197, 66, 0.55),
        0 0 28px 6px rgba(245, 197, 66, 0.35),
        0 12px 32px rgba(0,0,0,0.45);
      filter: brightness(1.08);
      animation: cfmGoldPulse 1.4s ease-in-out infinite;
    }
    @keyframes cfmGoldPulse {
      0%, 100% { box-shadow: 0 0 12px 2px rgba(245,197,66,0.5), 0 0 28px 6px rgba(245,197,66,0.3), 0 12px 32px rgba(0,0,0,0.45); }
      50% { box-shadow: 0 0 18px 4px rgba(255,224,138,0.75), 0 0 36px 10px rgba(245,197,66,0.45), 0 12px 32px rgba(0,0,0,0.45); }
    }
    html.cfm-list-view .card.card-mod-semana:hover {
      transform: translateY(-2px) scale(1.01);
    }
    .card.card-mod-top1 {
      border: 2px solid #a855f7 !important;
      background: linear-gradient(165deg, rgba(55, 30, 80, 0.95) 0%, rgba(31, 35, 43, 0.98) 55%) !important;
      box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.35), 0 8px 28px rgba(168, 85, 247, 0.18);
      transition: transform 0.2s ease, box-shadow 0.25s ease, border-color 0.25s ease, filter 0.25s ease;
    }
    .card.card-mod-top1:hover {
      transform: translateY(-8px) scale(1.02);
      border-color: #d8b4fe !important;
      box-shadow:
        0 0 12px 2px rgba(168, 85, 247, 0.55),
        0 0 28px 6px rgba(168, 85, 247, 0.35),
        0 12px 32px rgba(0,0,0,0.45);
      filter: brightness(1.08);
      animation: cfmPurplePulse 1.4s ease-in-out infinite;
    }
    @keyframes cfmPurplePulse {
      0%, 100% { box-shadow: 0 0 12px 2px rgba(168,85,247,0.5), 0 0 28px 6px rgba(168,85,247,0.3), 0 12px 32px rgba(0,0,0,0.45); }
      50% { box-shadow: 0 0 18px 4px rgba(216,180,254,0.75), 0 0 36px 10px rgba(168,85,247,0.45), 0 12px 32px rgba(0,0,0,0.45); }
    }
    html.cfm-list-view .card.card-mod-top1:hover {
      transform: translateY(-2px) scale(1.01);
    }
    /* Si es top1 y de la semana a la vez */
    .card.card-mod-semana.card-mod-top1 {
      border-image: none;
      border: 2px solid #f5c542 !important;
      box-shadow: 0 0 0 1px rgba(245,197,66,0.35), 0 0 12px rgba(168,85,247,0.35), 0 8px 28px rgba(245,197,66,0.15);
    }
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
    body.cfm-sm64-cursor,
    html.cfm-sm64-cursor *,
    body.cfm-sm64-cursor *,
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



    
    
    /* Grid density 2–6 + giant */
    html.cfm-grid-2 .grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    html.cfm-grid-3 .grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    html.cfm-grid-4 .grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
    html.cfm-grid-5 .grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
    html.cfm-grid-6 .grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
    html.cfm-grid-giant .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 22px !important;
    }
    html.cfm-grid-giant .grid .card-img-box {
        height: 220px !important;
        min-height: 220px !important;
    }
    html.cfm-grid-giant .grid .card-content h3 { font-size: 20px !important; }
    @media (max-width: 1100px) {
        html.cfm-grid-5 .grid,
        html.cfm-grid-6 .grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 900px) {
        html.cfm-grid-2 .grid,
        html.cfm-grid-3 .grid,
        html.cfm-grid-4 .grid,
        html.cfm-grid-5 .grid,
        html.cfm-grid-6 .grid,
        html.cfm-grid-giant .grid {
            grid-template-columns: 1fr !important;
        }
    }


    .profile-avatar-wrap { flex-shrink: 0; }
    .profile-avatar {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid #e11d48;
        background: #1f2937;
        display: block;
    }
    .profile-avatar-placeholder {
        display: flex !important;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: 800;
        color: #fff;
        background: linear-gradient(135deg, #374151, #1f2937);
    }


    .partner-box {
        margin: 28px 0 8px;
        border-radius: 16px;
        padding: 2px;
        background: linear-gradient(135deg, #a78bfa, #7c3aed, #c084fc, #6366f1);
        background-size: 200% 200%;
        animation: partnerGlow 4s ease infinite;
        box-shadow: 0 0 24px rgba(124, 58, 237, 0.45), 0 0 48px rgba(167, 139, 250, 0.25);
    }
    @keyframes partnerGlow {
        0%, 100% { background-position: 0% 50%; box-shadow: 0 0 20px rgba(124,58,237,.4), 0 0 40px rgba(167,139,250,.2); }
        50% { background-position: 100% 50%; box-shadow: 0 0 32px rgba(167,139,250,.55), 0 0 60px rgba(99,102,241,.3); }
    }
    .partner-box-inner {
        background: linear-gradient(160deg, #1e1b4b 0%, #16132e 50%, #0f0d1a 100%);
        border-radius: 14px;
        padding: 20px 22px;
    }
    .partner-badge {
        display: inline-block;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #1e1b4b;
        background: linear-gradient(90deg, #e9d5ff, #c4b5fd);
        padding: 4px 12px;
        border-radius: 999px;
    }
    .btn-partner-glow {
        display: inline-block;
        text-decoration: none !important;
        color: #fff !important;
        font-weight: 800;
        font-size: 15px;
        padding: 12px 22px;
        border-radius: 999px;
        background: linear-gradient(135deg, #7c3aed, #a78bfa 40%, #6366f1 80%, #7c3aed);
        background-size: 200% auto;
        box-shadow: 0 0 16px rgba(167, 139, 250, 0.55), 0 4px 14px rgba(99, 102, 241, 0.35);
        animation: partnerBtn 2.8s ease infinite;
        border: 1px solid rgba(255,255,255,0.25);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn-partner-glow:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 0 28px rgba(196, 181, 253, 0.75), 0 8px 24px rgba(124, 58, 237, 0.45);
        color: #fff !important;
    }
    @keyframes partnerBtn {
        0%, 100% { background-position: 0% center; }
        50% { background-position: 100% center; }
    }


    /* Fondo animado (capa separada — no pelea con background-position !important del body) */
    html.cfm-bg-move body {
        background-image: none !important;
        background-color: #111319 !important;
    }
    html.cfm-bg-move body::before {
        content: "";
        position: fixed;
        inset: -12%;
        z-index: -1;
        pointer-events: none;
        background-image: url('/public/fondo.jpg');
        background-repeat: repeat;
        background-size: 995px auto;
        animation: cfmBgDrift 35s linear infinite alternate;
        will-change: transform;
    }
    @keyframes cfmBgDrift {
        0% { transform: translate(0, 0); }
        100% { transform: translate(-6%, -4%); }
    }
    @media (prefers-reduced-motion: reduce) {
        html.cfm-bg-move body::before { animation: none !important; }
    }


    .profile-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
    .profile-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700;
      padding: 4px 10px; border-radius: 999px;
      background: linear-gradient(135deg, #1f2937, #111827);
      border: 1px solid #374151; color: #e5e7eb;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .profile-badge[title*="Moderador"] { border-color: #fbbf24; color: #fde68a; }
    .profile-badge[title*="descargas"] { border-color: #38bdf8; color: #bae6fd; }
    .profile-badge[title*="comentan"], .profile-badge[title*="comentador"] { border-color: #a78bfa; color: #ddd6fe; }
    .profile-badge[title*="semana"] { border-color: #f5d76e; color: #fef08a; }

    .featured-section { margin-top: 8px; }
    .featured-all-link {
      color: #93c5fd; font-size: 13px; text-decoration: none; font-weight: 600;
    }
    .featured-all-link:hover { color: #fff; text-decoration: underline; }
    .featured-carousel {
      position: relative;
      margin: 0 -4px;
    }
    .featured-viewport {
      overflow: hidden;
      border-radius: 4px;
    }
    .featured-track { position: relative; min-height: 140px; }
    .featured-slide {
      display: none;
      opacity: 0;
      transition: opacity 0.45s ease;
    }
    .featured-slide.is-active {
      display: block;
      opacity: 1;
      animation: featuredFade 0.45s ease;
    }
    @keyframes featuredFade {
      from { opacity: 0; transform: translateX(12px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .featured-slide-inner {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .featured-card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      text-decoration: none !important;
      color: inherit;
      background: linear-gradient(145deg, rgba(30, 41, 90, 0.92), rgba(20, 24, 48, 0.95));
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 16px;
      padding: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      min-height: 120px;
    }
    .featured-card:hover {
      transform: translateY(-4px);
      border-color: rgba(147, 197, 253, 0.55);
      box-shadow: 0 14px 32px rgba(0,0,0,0.45);
    }
    /* Fotos cuadradas / esquinas suaves — NO redondas */
    .featured-icon {
      width: 88px;
      height: 88px;
      min-width: 88px;
      border-radius: 12px;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.12);
      background: #0f172a;
    }
    .featured-icon-ph {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      border-radius: 12px;
    }
    .featured-body { flex: 1; min-width: 0; }
    .featured-title {
      margin: 0 0 6px;
      font-size: 16px;
      color: #f8fafc;
      font-weight: 800;
      line-height: 1.25;
    }
    .featured-desc {
      margin: 0 0 8px;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
      max-height: 2.8em;
      overflow: hidden;
    }
    .featured-meta {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .featured-author { color: #38bdf8; font-weight: 600; }
    .featured-sep { margin: 0 4px; opacity: 0.6; }
    .featured-stars {
      color: #fbbf24;
      font-size: 14px;
      letter-spacing: 1px;
    }
    .featured-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-70%);
      z-index: 3;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(15, 23, 42, 0.85);
      color: #fff;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .featured-nav:hover { background: #e11d48; border-color: #e11d48; }
    .featured-prev { left: -6px; }
    .featured-next { right: -6px; }
    .featured-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
    }
    .featured-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: none;
      padding: 0;
      background: rgba(148, 163, 184, 0.45);
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .featured-dot.is-active {
      background: #e11d48;
      transform: scale(1.25);
    }
    .featured-dot:hover { background: #94a3b8; }
    @media (max-width: 720px) {
      .featured-slide-inner { grid-template-columns: 1fr; }
      .featured-icon { width: 72px; height: 72px; min-width: 72px; border-radius: 10px; }
      .featured-prev { left: 0; }
      .featured-next { right: 0; }
    }
</style>`;

module.exports = { estilosCSS };
