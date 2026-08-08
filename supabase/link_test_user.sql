insert into client_users (user_id, client_id, role)
select '02fb0573-9c81-4928-bd74-d85b08431cfd', id, 'owner'
from clients
where name = 'Bracewell Flooring';
