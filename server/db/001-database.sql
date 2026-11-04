-- Run against master. Never drop, restore or reset an existing database.
IF DB_ID(N'web_thoi_trang') IS NULL
    CREATE DATABASE [web_thoi_trang];
