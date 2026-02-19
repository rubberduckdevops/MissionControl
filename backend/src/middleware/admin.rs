use axum::{extract::Request, middleware::Next, response::Response};

use crate::{errors::AppError, handlers::auth::Claims};

pub async fn require_admin(req: Request, next: Next) -> Result<Response, AppError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or(AppError::Unauthorized)?;

    if claims.role != "admin" {
        return Err(AppError::Forbidden);
    }

    Ok(next.run(req).await)
}
