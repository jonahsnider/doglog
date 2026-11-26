# A stand-in for a Systemcore's SSH server, for testing log sync.
# Systemcore logs in as the user robot code runs as with a password, like Debian's default SSH server.
FROM debian:12-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssh-server \
	&& rm -rf /var/lib/apt/lists/* \
	&& mkdir -p /run/sshd \
	&& ssh-keygen -A \
	&& useradd -m systemcore \
	&& echo systemcore:systemcore | chpasswd \
	# The USB drive is mounted at /U and linked from /u
	&& mkdir -p /U/logs /home/systemcore/logs \
	&& ln -s /U /u \
	&& head -c 3000 /dev/urandom > /U/logs/WPILIB_20270315_143000_CAPH_Q12.wpilog \
	&& head -c 2000 /dev/urandom > /home/systemcore/logs/WPILIB_20270314_090000.wpilog \
	&& chown -R systemcore /U /home/systemcore/logs
CMD ["/usr/sbin/sshd", "-D", "-e"]
