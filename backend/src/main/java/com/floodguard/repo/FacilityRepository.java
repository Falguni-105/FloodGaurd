package com.floodguard.repo;
import com.floodguard.domain.Facility;
import org.springframework.data.jpa.repository.JpaRepository;
public interface FacilityRepository extends JpaRepository<Facility, Long> {}
