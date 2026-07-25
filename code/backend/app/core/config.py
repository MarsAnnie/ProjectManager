from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ProjectManager"
    APP_VERSION: str = "1.0.1"

    # 数据库类型: "sqlite" 或 "mysql"（MySQL密码解决后切换）
    DB_TYPE: str = "sqlite"

    # MySQL 配置（DB_TYPE=mysql 时生效）
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "123456"
    DB_NAME: str = "projectmanager"

    BACKUP_PATH: str = "./backup"
    BACKUP_RETENTION_DAYS: int = 30
    WORK_DAYS_PER_MONTH: int = 22
    PROFIT_WARNING_LINE: float = 0.2

    AI_PROVIDER: str = "deepseek"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"

    @property
    def DATABASE_URL(self) -> str:
        if self.DB_TYPE == "mysql":
            return (
                f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
                f"?charset=utf8mb4"
            )
        return "sqlite:///./projectmanager.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
