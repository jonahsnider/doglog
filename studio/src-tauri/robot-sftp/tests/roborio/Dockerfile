# A stand-in for a roboRIO's SSH server, for testing log sync.
# roboRIOs run OpenSSH 8.3p1 configured by NI to allow logging in with no password, Alpine 3.12 ships the same version.
FROM alpine:3.12
RUN apk add --no-cache openssh-server openssh-sftp-server \
	&& adduser -D -h /home/lvuser lvuser \
	&& passwd -d lvuser \
	&& ssh-keygen -A \
	&& sed -i \
		-e 's|^#\?PasswordAuthentication .*|PasswordAuthentication yes|' \
		-e 's|^#\?PermitEmptyPasswords .*|PermitEmptyPasswords yes|' \
		-e 's|^#\?UseDNS .*|UseDNS no|' \
		/etc/ssh/sshd_config \
	# The USB drive is mounted elsewhere and linked from both /u and /U
	&& mkdir -p /media/sda1/logs /home/lvuser/logs \
	&& ln -s /media/sda1 /u \
	&& ln -s /media/sda1 /U \
	&& head -c 300000 /dev/urandom > /media/sda1/logs/FRC_20260315_143000_CAPH_Q12.wpilog \
	&& head -c 1000 /dev/urandom > /media/sda1/logs/akit_26-03-15_14-30-00.wpilog \
	&& head -c 1000 /dev/urandom > /media/sda1/logs/notes.txt \
	&& head -c 2000 /dev/urandom > /home/lvuser/logs/FRC_20260314_090000.wpilog \
	&& chown -R lvuser /media/sda1 /home/lvuser/logs
CMD ["/usr/sbin/sshd", "-D", "-e"]
