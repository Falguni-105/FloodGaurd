package com.floodguard.repo;
import com.floodguard.domain.Incident;
import com.floodguard.domain.IncidentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByStatusIn(Collection<IncidentStatus> statuses);
    List<Incident> findByReporterOrderByCreatedAtDesc(String reporter);
    List<Incident> findAllByOrderByCreatedAtDesc();
}
