const estilosCSS = `<style>
    body {
        background-image: url('/public/fondo.jpg') !important;
        background-repeat: repeat !important;
        background-color: #111319;
        color: #f1f3f5;
        font-family: sans-serif;
        margin: 0; padding: 0;
    }
    .navbar {
        background-color: rgba(15, 17, 21, 0.95);
        padding: 8px 40px;
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 3px solid #ff3333; backdrop-filter: blur(5px);
        flex-wrap: wrap; gap: 10px;
        min-height: 56px;
        max-height: none;
        overflow: visible;
    }
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
    .nav-links { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .nav-links a { color: #ced4da; text-decoration: none; font-weight: bold; font-size: 14px; }
    .nav-links a:hover { color: white; }
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
</style>`;

module.exports = { estilosCSS };
